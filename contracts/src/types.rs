//! On-chain data types, events, and errors for the SignalOracle contract.
//!
//! A `Signal` is a single directional market call published by an oracle. It
//! starts `PENDING` and is later `RESOLVED` against the real outcome, at which
//! point the publisher's on-chain `Reputation` (a verifiable accuracy score) is
//! updated. The consumer agent weights its action by that reputation — the
//! oracle's word is only worth its proven track record.

use odra::casper_types::U256;
use odra::prelude::*;

// --- Direction encoding (predicted price move over the horizon) --------------
pub const DIR_DOWN: u8 = 0;
pub const DIR_FLAT: u8 = 1;
pub const DIR_UP: u8 = 2;

// --- Signal lifecycle status -------------------------------------------------
pub const STATUS_PENDING: u8 = 0;
pub const STATUS_CORRECT: u8 = 1;
pub const STATUS_WRONG: u8 = 2;

/// A published, verifiable market signal. Prices are fixed-point integers in the
/// asset's smallest tracked unit (the agent uses micro-USD = price * 1_000_000),
/// keeping all on-chain math integer-only and deterministic.
#[odra::odra_type]
pub struct Signal {
    pub id: u64,
    /// CoinGecko-style asset id the call is about, e.g. "casper-network".
    pub asset: String,
    /// One of DIR_DOWN / DIR_FLAT / DIR_UP.
    pub direction: u8,
    /// Calibrated confidence 0..=100 the LLM staked on this call.
    pub confidence: u8,
    /// Prediction horizon in hours.
    pub horizon_hours: u32,
    /// Spot price (micro-USD) captured when the signal was published.
    pub price_at_publish: u64,
    /// LLM reasoning (<= 280 chars), kept on-chain for auditability.
    pub reasoning: String,
    /// Block time (ms) at publication.
    pub published_at: u64,
    /// One of STATUS_PENDING / STATUS_CORRECT / STATUS_WRONG.
    pub status: u8,
    /// Block time (ms) at resolution, 0 while pending.
    pub resolved_at: u64,
    /// Spot price (micro-USD) observed at resolution, 0 while pending.
    pub price_at_resolve: u64,
    /// The oracle account that published (and is graded for) this signal.
    pub publisher: Address,
}

/// Per-oracle reputation. `accuracy_bps` is the cumulative hit-rate in basis
/// points (0..=10000); consumers gate and scale their actions on it.
#[odra::odra_type]
pub struct Reputation {
    pub accuracy_bps: u32,
    pub total_signals: u32,
    pub resolved_signals: u32,
    pub correct_signals: u32,
}

// --- Events ------------------------------------------------------------------

#[odra::event]
pub struct SignalPublished {
    pub id: u64,
    pub publisher: Address,
    pub direction: u8,
    pub confidence: u8,
}

#[odra::event]
pub struct SignalResolved {
    pub id: u64,
    pub correct: bool,
    pub new_accuracy_bps: u32,
}

#[odra::event]
pub struct PublisherAuthorized {
    pub publisher: Address,
    pub authorized: bool,
}

/// An oracle bonded additional `x402USD` collateral. `total` is its new stake.
#[odra::event]
pub struct StakeDeposited {
    pub oracle: Address,
    pub amount: U256,
    pub total: U256,
}

/// A wrong resolution burned part of the publisher's bond. `remaining` is the
/// stake left after slashing; the slashed `amount` moved to the treasury.
#[odra::event]
pub struct StakeSlashed {
    pub oracle: Address,
    pub signal_id: u64,
    pub amount: U256,
    pub remaining: U256,
}

/// An oracle withdrew unlocked stake back to its own account.
#[odra::event]
pub struct StakeWithdrawn {
    pub oracle: Address,
    pub amount: U256,
    pub remaining: U256,
}

// --- Errors ------------------------------------------------------------------

#[odra::odra_error]
pub enum OracleError {
    /// Caller is not the owner / not an authorized publisher.
    NotAuthorized = 1,
    /// No signal exists for the given id.
    SignalNotFound = 2,
    /// Signal has already been resolved.
    AlreadyResolved = 3,
    /// Confidence outside 0..=100.
    InvalidConfidence = 4,
    /// Direction outside DIR_DOWN..=DIR_UP.
    InvalidDirection = 5,
    /// No signals have been published yet.
    NoSignals = 6,
    /// Asset id was empty.
    EmptyAsset = 7,
    /// Staking attempted before the owner set the stake token.
    StakeTokenNotSet = 8,
    /// Publisher's bonded stake is below the required minimum.
    InsufficientStake = 9,
    /// Cannot withdraw stake while the oracle has unresolved signals.
    StakeLocked = 10,
    /// Withdraw amount is zero or exceeds the available (unslashed) stake.
    NothingToWithdraw = 11,
    /// A zero amount was supplied where a positive one is required.
    ZeroAmount = 12,
}
