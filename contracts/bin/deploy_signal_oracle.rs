//! Livenet deployment for the SignalOracle contract.
//!
//! Reads ODRA_CASPER_LIVENET_* env vars (node address, chain name, secret key)
//! and deploys the pre-built `SignalOracle.wasm` to the configured Casper
//! network, printing the resulting contract address.
//!
//! Build the wasm first, then run with the livenet feature:
//!   cargo odra build
//!   cargo run --bin deploy_signal_oracle --features livenet
//!
//! Required env (see .env / scripts/deploy-contract.ps1):
//!   ODRA_CASPER_LIVENET_NODE_ADDRESS   e.g. https://node.testnet.cspr.cloud/rpc
//!   ODRA_CASPER_LIVENET_CHAIN_NAME     casper-test
//!   ODRA_CASPER_LIVENET_SECRET_KEY_PATH ./keys/producer_secret_key.pem

use odra::host::{Deployer, NoArgs};
use verity_signal_oracle::signal_oracle::SignalOracle;

fn main() {
    let env = odra_casper_livenet_env::env();

    // Deploy is the only state-changing op here; give it a generous gas ceiling.
    env.set_gas(250_000_000_000u64);
    let contract = SignalOracle::deploy(&env, NoArgs);

    let address = contract.address().to_string();
    println!("SignalOracle deployed.");
    println!("DEPLOYED_ADDRESS={address}");
    println!("Caller (owner/first publisher): {}", env.caller().to_string());
}
