//! Pure, deterministic reputation + correctness math.
//!
//! Kept free of any Odra storage types so it can be unit-tested in isolation and
//! reasoned about by judges: given a published price and a resolved price, was
//! the directional call correct, and what cumulative accuracy does that imply?

use crate::types::{DIR_DOWN, DIR_FLAT, DIR_UP};

/// Neutral prior accuracy (bps) for an oracle with no resolved signals yet.
pub const NEUTRAL_BPS: u32 = 5000;

/// Band (bps) within which a FLAT call counts as correct (+/- 0.50%).
pub const FLAT_BAND_BPS: u64 = 50;

/// Was the directional call correct, comparing publish vs resolve price?
/// FLAT is correct when the move stayed inside `flat_band_bps`. Integer-only.
pub fn is_correct(
    direction: u8,
    price_at_publish: u64,
    price_at_resolve: u64,
    flat_band_bps: u64,
) -> bool {
    match direction {
        DIR_UP => price_at_resolve > price_at_publish,
        DIR_DOWN => price_at_resolve < price_at_publish,
        DIR_FLAT => {
            let delta = price_at_resolve.abs_diff(price_at_publish) as u128;
            // |delta| / publish <= band/10000  <=>  delta*10000 <= publish*band
            delta * 10_000 <= (price_at_publish as u128) * (flat_band_bps as u128)
        }
        _ => false,
    }
}

/// Cumulative hit-rate accuracy in basis points (0..=10000). Returns the neutral
/// prior when nothing has resolved yet.
pub fn accuracy_bps(correct: u32, resolved: u32) -> u32 {
    if resolved == 0 {
        return NEUTRAL_BPS;
    }
    ((correct as u64 * 10_000) / resolved as u64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn up_call_correct_when_price_rises() {
        assert!(is_correct(DIR_UP, 1_000, 1_100, FLAT_BAND_BPS));
        assert!(!is_correct(DIR_UP, 1_000, 900, FLAT_BAND_BPS));
        assert!(!is_correct(DIR_UP, 1_000, 1_000, FLAT_BAND_BPS));
    }

    #[test]
    fn down_call_correct_when_price_falls() {
        assert!(is_correct(DIR_DOWN, 1_000, 900, FLAT_BAND_BPS));
        assert!(!is_correct(DIR_DOWN, 1_000, 1_100, FLAT_BAND_BPS));
    }

    #[test]
    fn flat_call_correct_inside_band_only() {
        // 0.5% band on 1_000_000 = +/- 5_000
        assert!(is_correct(DIR_FLAT, 1_000_000, 1_004_000, FLAT_BAND_BPS));
        assert!(is_correct(DIR_FLAT, 1_000_000, 996_000, FLAT_BAND_BPS));
        assert!(!is_correct(DIR_FLAT, 1_000_000, 1_010_000, FLAT_BAND_BPS));
    }

    #[test]
    fn accuracy_is_neutral_without_history() {
        assert_eq!(accuracy_bps(0, 0), NEUTRAL_BPS);
    }

    #[test]
    fn accuracy_is_cumulative_hit_rate() {
        assert_eq!(accuracy_bps(4, 5), 8_000);
        assert_eq!(accuracy_bps(1, 1), 10_000);
        assert_eq!(accuracy_bps(0, 3), 0);
    }
}
