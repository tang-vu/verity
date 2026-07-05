//! Pure staking/slashing math for the SignalOracle.
//!
//! Kept free of any Odra storage types so the economic rule — how much bonded
//! collateral a single wrong call destroys — is unit-testable and auditable in
//! isolation, exactly like `reputation_math`.

use odra::casper_types::U256;

/// Fraction (bps) of an oracle's *remaining* bonded stake slashed when one of its
/// signals resolves WRONG. 2000 bps = 20%: a run of bad calls compounds down, so an
/// oracle's live collateral tracks its recent honesty, not just a lifetime average.
pub const SLASH_BPS: u64 = 2_000;

/// Basis-point denominator.
pub const BPS_DENOM: u64 = 10_000;

/// Amount slashed from `stake` for a single wrong resolution.
/// `= stake * slash_bps / 10000`, integer-floored. Zero stake slashes zero.
pub fn slash_amount(stake: U256, slash_bps: u64) -> U256 {
    stake * U256::from(slash_bps) / U256::from(BPS_DENOM)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slashes_the_bps_fraction_of_stake() {
        assert_eq!(slash_amount(U256::from(10_000u64), SLASH_BPS), U256::from(2_000u64));
        // Floors: 12_345 * 0.20 = 2_469.0 exactly here.
        assert_eq!(slash_amount(U256::from(12_345u64), SLASH_BPS), U256::from(2_469u64));
    }

    #[test]
    fn zero_stake_slashes_zero() {
        assert_eq!(slash_amount(U256::zero(), SLASH_BPS), U256::zero());
    }

    #[test]
    fn slashing_compounds_downwards() {
        // Three consecutive wrong calls on a 1_000 bond: 1000 -> 800 -> 640 -> 512.
        let mut stake = U256::from(1_000u64);
        for _ in 0..3 {
            stake -= slash_amount(stake, SLASH_BPS);
        }
        assert_eq!(stake, U256::from(512u64));
    }
}
