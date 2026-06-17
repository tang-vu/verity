//! `SignalOracle` — stores verifiable market signals and maintains an on-chain
//! reputation (accuracy) score per oracle that updates as signals resolve.
//!
//! This is the trust anchor of verity: a consumer reading the latest signal can
//! independently verify the publisher's historical accuracy on-chain and weight
//! its action accordingly. No off-chain trust required.

use odra::prelude::*;

use crate::reputation_math::{accuracy_bps, is_correct, FLAT_BAND_BPS, NEUTRAL_BPS};
use crate::types::{
    OracleError, PublisherAuthorized, Reputation, Signal, SignalPublished, SignalResolved,
    DIR_UP, STATUS_CORRECT, STATUS_PENDING, STATUS_WRONG,
};

#[odra::module(events = [SignalPublished, SignalResolved, PublisherAuthorized])]
pub struct SignalOracle {
    owner: Var<Address>,
    next_id: Var<u64>,
    signals: Mapping<u64, Signal>,
    reputation: Mapping<Address, Reputation>,
    publishers: Mapping<Address, bool>,
}

#[odra::module]
impl SignalOracle {
    /// Deployer becomes owner and the first authorized publisher.
    pub fn init(&mut self) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.next_id.set(0);
        self.publishers.set(&caller, true);
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

        let id = self.next_id.get_or_default();
        let publisher = self.env().caller();
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

    // --- Internal helpers (not entrypoints) ----------------------------------

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
