//! `SignalOracle` — stores verifiable market signals and maintains an on-chain
//! reputation (accuracy) score per oracle that updates as signals resolve.
//!
//! This is the trust anchor of verity: a consumer reading the latest signal can
//! independently verify the publisher's historical accuracy on-chain and weight
//! its action accordingly. No off-chain trust required.

use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;

use crate::reputation_math::{accuracy_bps, is_correct, FLAT_BAND_BPS, NEUTRAL_BPS};
use crate::staking_math::{slash_amount, SLASH_BPS};
use crate::types::{
    OracleError, PublisherAuthorized, Reputation, Signal, SignalPublished, SignalResolved,
    StakeDeposited, StakeSlashed, StakeWithdrawn, DIR_UP, STATUS_CORRECT, STATUS_PENDING,
    STATUS_WRONG,
};

/// Minimal external interface for the CEP-18 collateral asset (verity's x402USD).
/// The argument names mirror what the deployed `X402Token` exposes (`to` for
/// `transfer`; `owner`/`recipient` for `transfer_from`) so cross-contract calls
/// bind to the live token without redeploying it.
#[odra::external_contract]
pub trait StakeToken {
    fn transfer(&mut self, to: &Address, amount: &U256);
    fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
}

#[odra::module(events = [
    SignalPublished, SignalResolved, PublisherAuthorized,
    StakeDeposited, StakeSlashed, StakeWithdrawn,
])]
pub struct SignalOracle {
    owner: Var<Address>,
    next_id: Var<u64>,
    signals: Mapping<u64, Signal>,
    reputation: Mapping<Address, Reputation>,
    publishers: Mapping<Address, bool>,
    /// The CEP-18 asset oracles bond as collateral (verity's x402USD). Unset until
    /// the owner wires it, which keeps the contract usable stake-free in tests.
    stake_token: Var<Option<Address>>,
    /// Bonded collateral per oracle (in the stake token's base units).
    stakes: Mapping<Address, U256>,
    /// Unresolved-signal count per oracle; stake is withdrawal-locked while > 0.
    pending_count: Mapping<Address, u32>,
    /// Minimum bond required to publish. Zero disables the gate (default).
    min_stake: Var<U256>,
    /// Cumulative collateral slashed across all wrong resolutions.
    slashed_total: Var<U256>,
    /// Where slashed collateral flows (a consumer-protection treasury). Defaults
    /// to the owner until set.
    treasury: Var<Option<Address>>,
}

#[odra::module]
impl SignalOracle {
    /// Deployer becomes owner and the first authorized publisher. Staking starts
    /// disabled (no token, zero minimum) so it can be wired up post-deploy.
    pub fn init(&mut self) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.next_id.set(0);
        self.publishers.set(&caller, true);
        self.stake_token.set(None);
        self.min_stake.set(U256::zero());
        self.slashed_total.set(U256::zero());
        self.treasury.set(None);
    }

    /// Publish a new PENDING signal. Returns its id. Publisher-only.
    pub fn publish_signal(
        &mut self,
        asset: String,
        direction: u8,
        confidence: u8,
        horizon_hours: u32,
        price_at_publish: u64,
        reasoning: String,
    ) -> u64 {
        self.assert_publisher();
        if asset.is_empty() {
            self.env().revert(OracleError::EmptyAsset);
        }
        if confidence > 100 {
            self.env().revert(OracleError::InvalidConfidence);
        }
        if direction > DIR_UP {
            self.env().revert(OracleError::InvalidDirection);
        }

        // Skin in the game: an oracle must have collateral at risk to publish. The
        // consumer's trust is only meaningful because a wrong call costs the oracle
        // real, slashable stake — not just a reputation number.
        let publisher = self.env().caller();
        if self.stake_of(&publisher) < self.min_stake.get_or_default() {
            self.env().revert(OracleError::InsufficientStake);
        }

        let id = self.next_id.get_or_default();
        let signal = Signal {
            id,
            asset,
            direction,
            confidence,
            horizon_hours,
            price_at_publish,
            reasoning,
            published_at: self.env().get_block_time(),
            status: STATUS_PENDING,
            resolved_at: 0,
            price_at_resolve: 0,
            publisher,
        };
        self.signals.set(&id, signal);
        self.next_id.set(id + 1);

        let mut rep = self.rep_of(&publisher);
        rep.total_signals += 1;
        self.reputation.set(&publisher, rep);

        // Lock the bond until this signal is graded.
        self.pending_count.set(&publisher, self.pending_of(&publisher) + 1);

        self.env().emit_event(SignalPublished { id, publisher, direction, confidence });
        id
    }

    /// Resolve a pending signal against the observed price. Grades the call and
    /// updates the publisher's cumulative accuracy. Publisher or owner only.
    pub fn resolve_signal(&mut self, id: u64, price_at_resolve: u64) {
        let mut signal = match self.signals.get(&id) {
            Some(s) => s,
            None => self.env().revert(OracleError::SignalNotFound),
        };
        let caller = self.env().caller();
        if caller != signal.publisher && caller != self.current_owner() {
            self.env().revert(OracleError::NotAuthorized);
        }
        if signal.status != STATUS_PENDING {
            self.env().revert(OracleError::AlreadyResolved);
        }

        let correct = is_correct(
            signal.direction,
            signal.price_at_publish,
            price_at_resolve,
            FLAT_BAND_BPS,
        );
        let publisher = signal.publisher;
        signal.status = if correct { STATUS_CORRECT } else { STATUS_WRONG };
        signal.price_at_resolve = price_at_resolve;
        signal.resolved_at = self.env().get_block_time();
        self.signals.set(&id, signal);

        let mut rep = self.rep_of(&publisher);
        rep.resolved_signals += 1;
        if correct {
            rep.correct_signals += 1;
        }
        rep.accuracy_bps = accuracy_bps(rep.correct_signals, rep.resolved_signals);
        let new_accuracy_bps = rep.accuracy_bps;
        self.reputation.set(&publisher, rep);

        // This signal is graded: release its lock on the bond.
        let pending = self.pending_of(&publisher);
        if pending > 0 {
            self.pending_count.set(&publisher, pending - 1);
        }

        // A wrong call burns part of the bond. The slashed collateral flows to the
        // treasury (a consumer-protection pool), so bad data literally pays out to
        // the agents it could have misled.
        if !correct {
            self.slash(publisher, id);
        }

        self.env().emit_event(SignalResolved { id, correct, new_accuracy_bps });
    }

    // --- Read-only views -----------------------------------------------------

    pub fn get_signal(&self, id: u64) -> Signal {
        match self.signals.get(&id) {
            Some(s) => s,
            None => self.env().revert(OracleError::SignalNotFound),
        }
    }

    pub fn latest_signal_id(&self) -> u64 {
        let n = self.next_id.get_or_default();
        if n == 0 {
            self.env().revert(OracleError::NoSignals);
        }
        n - 1
    }

    pub fn get_latest_signal(&self) -> Signal {
        let id = self.latest_signal_id();
        self.get_signal(id)
    }

    pub fn get_reputation(&self, oracle: Address) -> Reputation {
        self.rep_of(&oracle)
    }

    pub fn signal_count(&self) -> u64 {
        self.next_id.get_or_default()
    }

    pub fn is_publisher(&self, account: Address) -> bool {
        self.publishers.get(&account).unwrap_or(false)
    }

    // --- Owner-gated admin ---------------------------------------------------

    pub fn add_publisher(&mut self, publisher: Address) {
        self.assert_owner();
        self.publishers.set(&publisher, true);
        self.env().emit_event(PublisherAuthorized { publisher, authorized: true });
    }

    pub fn remove_publisher(&mut self, publisher: Address) {
        self.assert_owner();
        self.publishers.set(&publisher, false);
        self.env().emit_event(PublisherAuthorized { publisher, authorized: false });
    }

    /// Wire the CEP-18 collateral asset (verity's x402USD). Owner only.
    pub fn set_stake_token(&mut self, token: Address) {
        self.assert_owner();
        self.stake_token.set(Some(token));
    }

    /// Set the minimum bond required to publish. Owner only.
    pub fn set_min_stake(&mut self, amount: U256) {
        self.assert_owner();
        self.min_stake.set(amount);
    }

    /// Set the treasury that receives slashed collateral. Owner only.
    pub fn set_treasury(&mut self, treasury: Address) {
        self.assert_owner();
        self.treasury.set(Some(treasury));
    }

    // --- Staking (collateral behind the oracle's word) -----------------------

    /// Bond `amount` of the stake token as collateral. The caller must have
    /// `approve`d this contract for `amount` on the token first; we pull it via
    /// `transfer_from`. Raises the caller's at-risk stake.
    pub fn stake(&mut self, amount: U256) {
        if amount.is_zero() {
            self.env().revert(OracleError::ZeroAmount);
        }
        let token = self.require_stake_token();
        let oracle = self.env().caller();
        let this = self.env().self_address();
        StakeTokenContractRef::new(self.env(), token).transfer_from(&oracle, &this, &amount);

        let total = self.stake_of(&oracle) + amount;
        self.stakes.set(&oracle, total);
        self.env().emit_event(StakeDeposited { oracle, amount, total });
    }

    /// Withdraw `amount` of unslashed, unlocked stake back to the caller. Blocked
    /// while the oracle has any pending (ungraded) signal — you can't pull your
    /// bond out from under an outstanding call.
    pub fn withdraw_stake(&mut self, amount: U256) {
        let oracle = self.env().caller();
        if self.pending_of(&oracle) > 0 {
            self.env().revert(OracleError::StakeLocked);
        }
        let stake = self.stake_of(&oracle);
        if amount.is_zero() || amount > stake {
            self.env().revert(OracleError::NothingToWithdraw);
        }
        let token = self.require_stake_token();
        let remaining = stake - amount;
        self.stakes.set(&oracle, remaining);
        StakeTokenContractRef::new(self.env(), token).transfer(&oracle, &amount);
        self.env().emit_event(StakeWithdrawn { oracle, amount, remaining });
    }

    pub fn get_stake(&self, oracle: Address) -> U256 {
        self.stake_of(&oracle)
    }

    pub fn min_stake(&self) -> U256 {
        self.min_stake.get_or_default()
    }

    pub fn slashed_total(&self) -> U256 {
        self.slashed_total.get_or_default()
    }

    pub fn pending_count_of(&self, oracle: Address) -> u32 {
        self.pending_of(&oracle)
    }

    pub fn stake_token(&self) -> Option<Address> {
        self.stake_token.get_or_default()
    }

    // --- Internal helpers (not entrypoints) ----------------------------------

    /// Burn `SLASH_BPS` of `publisher`'s remaining bond and route it to the
    /// treasury. No-op when the oracle holds no stake (or no token is wired).
    fn slash(&mut self, publisher: Address, signal_id: u64) {
        let token = match self.stake_token.get_or_default() {
            Some(t) => t,
            None => return,
        };
        let stake = self.stake_of(&publisher);
        let amount = slash_amount(stake, SLASH_BPS);
        if amount.is_zero() {
            return;
        }
        let remaining = stake - amount;
        self.stakes.set(&publisher, remaining);
        self.slashed_total.set(self.slashed_total.get_or_default() + amount);

        let treasury = self.treasury.get_or_default().unwrap_or_else(|| self.current_owner());
        StakeTokenContractRef::new(self.env(), token).transfer(&treasury, &amount);
        self.env().emit_event(StakeSlashed { oracle: publisher, signal_id, amount, remaining });
    }

    fn stake_of(&self, account: &Address) -> U256 {
        self.stakes.get(account).unwrap_or_default()
    }

    fn pending_of(&self, account: &Address) -> u32 {
        self.pending_count.get(account).unwrap_or(0)
    }

    fn require_stake_token(&self) -> Address {
        match self.stake_token.get_or_default() {
            Some(t) => t,
            None => self.env().revert(OracleError::StakeTokenNotSet),
        }
    }

    fn rep_of(&self, account: &Address) -> Reputation {
        self.reputation.get(account).unwrap_or(Reputation {
            accuracy_bps: NEUTRAL_BPS,
            total_signals: 0,
            resolved_signals: 0,
            correct_signals: 0,
        })
    }

    fn current_owner(&self) -> Address {
        match self.owner.get() {
            Some(o) => o,
            None => self.env().revert(OracleError::NotAuthorized),
        }
    }

    fn assert_owner(&self) {
        if self.env().caller() != self.current_owner() {
            self.env().revert(OracleError::NotAuthorized);
        }
    }

    fn assert_publisher(&self) {
        if !self.publishers.get(&self.env().caller()).unwrap_or(false) {
            self.env().revert(OracleError::NotAuthorized);
        }
    }
}
