//! `X402Token` — the CEP-18 payment asset for verity's x402 paywall.
//!
//! A standard CEP-18 token augmented with CEP-3009 (`transfer_with_authorization`,
//! EIP-712 gasless transfers) and CEP-2612 (`permit`). The x402 facilitator settles
//! a paid signal read by submitting a `transfer_with_authorization` deploy against
//! this contract, so the consumer pays the oracle without ever sending a tx itself.
//!
//! Structure mirrors Odra's official gasless CEP-18 example; metadata is aligned
//! with the verity `.env` (name "x402USD", symbol "x402", 2 decimals).

#![allow(clippy::too_many_arguments)]

use odra::casper_types::bytesrepr::Bytes;
use odra::casper_types::{PublicKey, U256};
use odra::prelude::*;
use odra_modules::cep18_token::Cep18;
use odra_modules::cep2612::CEP2612;
use odra_modules::cep3009::CEP3009;

/// Initial supply in the token's smallest unit (2 decimals → 10,000,000,000.00).
const INITIAL_SUPPLY: u64 = 1_000_000_000_000;

#[odra::module]
pub struct X402Token {
    token: SubModule<Cep18>,
    cep3009: SubModule<CEP3009>,
    cep2612: SubModule<CEP2612>,
}

#[odra::module]
impl X402Token {
    /// `chain_name` becomes the EIP-712 domain chain id used to verify
    /// authorizations; pass the same CAIP-2 value the x402 client signs with
    /// (e.g. "casper:casper-test").
    pub fn init(&mut self, chain_name: String) {
        self.cep3009.init(chain_name.clone());
        self.cep2612.init(chain_name);
        // Cep18::init signature is (symbol, name, decimals, initial_supply).
        self.token.init(
            "x402".to_string(),
            "x402USD".to_string(),
            2,
            U256::from(INITIAL_SUPPLY),
        );
    }

    delegate! {
        to self.token {
            fn name(&self) -> String;
            fn symbol(&self) -> String;
            fn decimals(&self) -> u8;
            fn total_supply(&self) -> U256;
            fn balance_of(&self, owner: &Address) -> U256;
            fn transfer(&mut self, to: &Address, amount: &U256);
            fn approve(&mut self, spender: &Address, amount: &U256);
            fn allowance(&self, owner: &Address, spender: &Address) -> U256;
            fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
            fn decrease_allowance(&mut self, spender: &Address, decr_by: &U256);
            fn increase_allowance(&mut self, spender: &Address, inc_by: &U256);
        }

        to self.cep3009 {
            fn authorization_state(&self, authorizer: Address, nonce: Bytes) -> bool;
            fn transfer_with_authorization(&mut self, from: Address, to: Address, amount: U256, valid_after: u64, valid_before: u64, nonce: Bytes, public_key: PublicKey, signature: Bytes);
            fn receive_with_authorization(&mut self, from: Address, to: Address, amount: U256, valid_after: u64, valid_before: u64, nonce: Bytes, public_key: PublicKey, signature: Bytes);
        }

        to self.cep2612 {
            fn permit(&mut self, owner: Address, spender: Address, value: U256, deadline: u64, public_key: PublicKey, signature: Bytes);
        }
    }
}
