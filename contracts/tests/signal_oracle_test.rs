//! Host (OdraVM) integration tests for the SignalOracle contract.
//!
//! Exercises the full signal lifecycle and the on-chain reputation update that
//! makes the oracle's word verifiable: publish -> resolve -> accuracy moves.

use odra::casper_types::U256;
use odra::host::{Deployer, HostRef, NoArgs};
use odra::prelude::Addressable;
use verity_signal_oracle::reputation_math::NEUTRAL_BPS;
use verity_signal_oracle::signal_oracle::SignalOracle;
use verity_signal_oracle::types::{
    OracleError, DIR_DOWN, DIR_UP, STATUS_CORRECT, STATUS_PENDING, STATUS_WRONG,
};
use verity_signal_oracle::x402_token::{X402Token, X402TokenHostRef, X402TokenInitArgs};

fn deploy() -> (odra::host::HostEnv, SignalOracleHostRef) {
    let env = odra_test::env();
    let oracle = SignalOracle::deploy(&env, NoArgs);
    (env, oracle)
}

// Bring the generated host ref type into scope.
use verity_signal_oracle::signal_oracle::SignalOracleHostRef;

#[test]
fn publishes_and_reads_latest_signal() {
    let (_env, mut oracle) = deploy();
    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        72,
        24,
        1_000_000,
        "Funding flipped positive; 24h volume up 18%.".to_string(),
    );
    assert_eq!(id, 0);
    assert_eq!(oracle.signal_count(), 1);

    let latest = oracle.get_latest_signal();
    assert_eq!(latest.id, 0);
    assert_eq!(latest.direction, DIR_UP);
    assert_eq!(latest.confidence, 72);
    assert_eq!(latest.status, STATUS_PENDING);
    assert_eq!(latest.price_at_publish, 1_000_000);
}

#[test]
fn new_oracle_starts_at_neutral_reputation() {
    let (env, oracle) = deploy();
    let owner = env.get_account(0);
    let rep = oracle.get_reputation(owner);
    assert_eq!(rep.accuracy_bps, NEUTRAL_BPS);
    assert_eq!(rep.total_signals, 0);
    assert_eq!(rep.resolved_signals, 0);
}

#[test]
fn resolving_correct_signal_raises_accuracy() {
    let (env, mut oracle) = deploy();
    let owner = env.get_account(0);

    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        80,
        24,
        1_000_000,
        "Breakout above resistance.".to_string(),
    );
    // Price rose -> UP call correct.
    oracle.resolve_signal(id, 1_100_000);

    let signal = oracle.get_signal(id);
    assert_eq!(signal.status, STATUS_CORRECT);
    assert_eq!(signal.price_at_resolve, 1_100_000);

    let rep = oracle.get_reputation(owner);
    assert_eq!(rep.resolved_signals, 1);
    assert_eq!(rep.correct_signals, 1);
    assert_eq!(rep.accuracy_bps, 10_000);
}

#[test]
fn resolving_wrong_signal_lowers_accuracy() {
    let (env, mut oracle) = deploy();
    let owner = env.get_account(0);

    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_DOWN,
        60,
        24,
        1_000_000,
        "Expecting a pullback.".to_string(),
    );
    // Price rose -> DOWN call wrong.
    oracle.resolve_signal(id, 1_050_000);

    let signal = oracle.get_signal(id);
    assert_eq!(signal.status, STATUS_WRONG);

    let rep = oracle.get_reputation(owner);
    assert_eq!(rep.resolved_signals, 1);
    assert_eq!(rep.correct_signals, 0);
    assert_eq!(rep.accuracy_bps, 0);
}

#[test]
fn cumulative_accuracy_tracks_hit_rate() {
    let (_env, mut oracle) = deploy();

    // 3 correct UP calls, 1 wrong DOWN call -> 3/4 = 7500 bps.
    for _ in 0..3 {
        let id = oracle.publish_signal(
            "casper-network".to_string(),
            DIR_UP,
            70,
            24,
            1_000_000,
            "up".to_string(),
        );
        oracle.resolve_signal(id, 1_100_000);
    }
    let wrong = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_DOWN,
        70,
        24,
        1_000_000,
        "down".to_string(),
    );
    oracle.resolve_signal(wrong, 1_100_000);

    let rep = oracle.get_reputation(oracle.get_signal(0).publisher);
    assert_eq!(rep.resolved_signals, 4);
    assert_eq!(rep.correct_signals, 3);
    assert_eq!(rep.accuracy_bps, 7_500);
}

#[test]
fn unauthorized_account_cannot_publish() {
    let (env, mut oracle) = deploy();
    let stranger = env.get_account(1);
    env.set_caller(stranger);

    let err = oracle
        .try_publish_signal(
            "casper-network".to_string(),
            DIR_UP,
            50,
            24,
            1_000_000,
            "x".to_string(),
        )
        .unwrap_err();
    assert_eq!(err, OracleError::NotAuthorized.into());
}

#[test]
fn owner_can_authorize_new_publisher() {
    let (env, mut oracle) = deploy();
    let new_pub = env.get_account(1);
    oracle.add_publisher(new_pub);
    assert!(oracle.is_publisher(new_pub));

    env.set_caller(new_pub);
    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        55,
        12,
        1_000_000,
        "authorized".to_string(),
    );
    assert_eq!(id, 0);
}

#[test]
fn invalid_confidence_is_rejected() {
    let (_env, mut oracle) = deploy();
    let err = oracle
        .try_publish_signal(
            "casper-network".to_string(),
            DIR_UP,
            101,
            24,
            1_000_000,
            "x".to_string(),
        )
        .unwrap_err();
    assert_eq!(err, OracleError::InvalidConfidence.into());
}

#[test]
fn double_resolution_is_rejected() {
    let (_env, mut oracle) = deploy();
    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        50,
        24,
        1_000_000,
        "x".to_string(),
    );
    oracle.resolve_signal(id, 1_100_000);
    let err = oracle.try_resolve_signal(id, 1_200_000).unwrap_err();
    assert_eq!(err, OracleError::AlreadyResolved.into());
}

// --- Staking + slashing (collateral behind the oracle's word) ----------------
//
// The stake asset is the x402USD CEP-18 token: the same asset consumers pay in,
// so an oracle bonds real, slashable capital against its accuracy. These tests
// deploy both contracts and exercise the full cross-contract collateral flow.

/// Deploy the token + oracle, wire the token as collateral. Account 0 (the
/// deployer) owns both and holds the token's full initial supply.
fn deploy_with_stake() -> (odra::host::HostEnv, SignalOracleHostRef, X402TokenHostRef) {
    let env = odra_test::env();
    let token = X402Token::deploy(
        &env,
        X402TokenInitArgs { chain_name: "casper:casper-test".to_string() },
    );
    let mut oracle = SignalOracle::deploy(&env, NoArgs);
    oracle.set_stake_token(token.address());
    (env, oracle, token)
}

#[test]
fn publish_requires_min_stake_when_set() {
    let (env, mut oracle, mut token) = deploy_with_stake();
    let owner = env.get_account(0);
    oracle.set_min_stake(U256::from(100u64));

    // Authorized but unbonded → publish is rejected.
    let err = oracle
        .try_publish_signal(
            "casper-network".to_string(),
            DIR_UP,
            60,
            24,
            1_000_000,
            "x".to_string(),
        )
        .unwrap_err();
    assert_eq!(err, OracleError::InsufficientStake.into());

    // Approve the oracle contract, bond collateral, then publishing works.
    token.approve(&oracle.address(), &U256::from(1_000u64));
    oracle.stake(U256::from(500u64));
    assert_eq!(oracle.get_stake(owner), U256::from(500u64));

    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        60,
        24,
        1_000_000,
        "bonded".to_string(),
    );
    assert_eq!(id, 0);
}

#[test]
fn wrong_resolution_slashes_bond_to_treasury() {
    let (env, mut oracle, mut token) = deploy_with_stake();
    let owner = env.get_account(0);
    let treasury = env.get_account(1);
    oracle.set_treasury(treasury);
    oracle.set_min_stake(U256::from(100u64));
    token.approve(&oracle.address(), &U256::from(1_000u64));
    oracle.stake(U256::from(500u64));

    let treasury_before = token.balance_of(&treasury);
    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_DOWN,
        60,
        24,
        1_000_000,
        "down".to_string(),
    );
    // Price rose → DOWN wrong → slash 20% of 500 = 100.
    oracle.resolve_signal(id, 1_050_000);

    assert_eq!(oracle.get_stake(owner), U256::from(400u64));
    assert_eq!(oracle.slashed_total(), U256::from(100u64));
    assert_eq!(token.balance_of(&treasury), treasury_before + U256::from(100u64));
}

#[test]
fn correct_resolution_keeps_bond_intact() {
    let (env, mut oracle, mut token) = deploy_with_stake();
    let owner = env.get_account(0);
    oracle.set_min_stake(U256::from(100u64));
    token.approve(&oracle.address(), &U256::from(1_000u64));
    oracle.stake(U256::from(500u64));

    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        60,
        24,
        1_000_000,
        "up".to_string(),
    );
    oracle.resolve_signal(id, 1_100_000); // correct

    assert_eq!(oracle.get_stake(owner), U256::from(500u64));
    assert_eq!(oracle.slashed_total(), U256::zero());
}

#[test]
fn stake_is_locked_until_signals_resolve() {
    let (env, mut oracle, mut token) = deploy_with_stake();
    let owner = env.get_account(0);
    oracle.set_min_stake(U256::from(100u64));
    token.approve(&oracle.address(), &U256::from(1_000u64));
    oracle.stake(U256::from(500u64));

    let id = oracle.publish_signal(
        "casper-network".to_string(),
        DIR_UP,
        60,
        24,
        1_000_000,
        "pending".to_string(),
    );
    // A pending signal locks the bond.
    let err = oracle.try_withdraw_stake(U256::from(100u64)).unwrap_err();
    assert_eq!(err, OracleError::StakeLocked.into());

    oracle.resolve_signal(id, 1_100_000); // correct → pending clears
    let bal_before = token.balance_of(&owner);
    oracle.withdraw_stake(U256::from(500u64));
    assert_eq!(oracle.get_stake(owner), U256::zero());
    assert_eq!(token.balance_of(&owner), bal_before + U256::from(500u64));
}

#[test]
fn staking_without_token_reverts() {
    let (_env, mut oracle) = deploy(); // no stake token wired
    let err = oracle.try_stake(U256::from(100u64)).unwrap_err();
    assert_eq!(err, OracleError::StakeTokenNotSet.into());
}

#[test]
fn zero_stake_amount_reverts() {
    let (_env, mut oracle, _token) = deploy_with_stake();
    let err = oracle.try_stake(U256::zero()).unwrap_err();
    assert_eq!(err, OracleError::ZeroAmount.into());
}
