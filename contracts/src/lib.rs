//! verity SignalOracle — Casper smart contract layer (Rust + Odra).
//!
//! Modules:
//! - `types`            on-chain structs, events, errors
//! - `reputation_math`  pure correctness + accuracy math (unit-tested)
//! - `signal_oracle`    the contract: signals + per-oracle reputation

#![cfg_attr(not(test), no_std)]

extern crate alloc;

pub mod reputation_math;
pub mod signal_oracle;
pub mod types;
pub mod x402_token;
