//! Host (OdraVM) tests for the X402Token (CEP-18 + CEP-3009 + CEP-2612) used as
//! the x402 payment asset. Verifies metadata + a plain transfer; the EIP-712
//! `transfer_with_authorization` path is exercised end-to-end against the live
//! facilitator (see scripts/deploy-x402-token.ts + the agent loop).

use odra::casper_types::U256;
use odra::host::{Deployer, HostRef};
use verity_signal_oracle::x402_token::{X402Token, X402TokenInitArgs};

fn deploy() -> (odra::host::HostEnv, X402TokenHostRef) {
    let env = odra_test::env();
    let token = X402Token::deploy(
        &env,
        X402TokenInitArgs { chain_name: "casper:casper-test".to_string() },
    );
    (env, token)
}

use verity_signal_oracle::x402_token::X402TokenHostRef;

#[test]
fn token_metadata_matches_x402_config() {
    let (_env, token) = deploy();
    assert_eq!(token.name(), "x402USD");
    assert_eq!(token.symbol(), "x402");
    assert_eq!(token.decimals(), 2);
    assert_eq!(token.total_supply(), U256::from(1_000_000_000_000u64));
}

#[test]
fn deployer_holds_initial_supply() {
    let (env, token) = deploy();
    let deployer = env.get_account(0);
    assert_eq!(token.balance_of(&deployer), U256::from(1_000_000_000_000u64));
}

#[test]
fn transfer_moves_balance_to_recipient() {
    let (env, mut token) = deploy();
    let recipient = env.get_account(1);
    token.transfer(&recipient, &U256::from(10_000u64));
    assert_eq!(token.balance_of(&recipient), U256::from(10_000u64));
}
