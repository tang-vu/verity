//! Odra contracts build script: uses the ODRA_MODULE env var to set the
//! `odra_module` cfg flag so the selected contract's wasm entry points compile.

pub fn main() {
    odra_build::build();
}
