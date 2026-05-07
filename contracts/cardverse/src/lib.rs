#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token,
    Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Treasury,
    XlmToken,
    RarityPrice(String),
    Holdings(Address, String),
}

#[contract]
pub struct CardVerse;

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized")
}

#[contractimpl]
impl CardVerse {
    /// One-time setup: admin, treasury wallet, XLM token SAC address
    pub fn initialize(env: Env, admin: Address, treasury: Address, xlm_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Admin: configure XLM price for a rarity tier (in stroops, 1 XLM = 10_000_000)
    pub fn set_price(env: Env, rarity: String, price: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        assert!(price > 0, "price must be positive");
        env.storage()
            .instance()
            .set(&DataKey::RarityPrice(rarity), &price);
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Return XLM price (stroops) for a rarity tier
    pub fn get_price(env: Env, rarity: String) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::RarityPrice(rarity))
            .expect("rarity not configured")
    }

    /// Buy a card: deducts XLM from buyer → treasury, records on-chain ownership
    pub fn buy(env: Env, buyer: Address, card_code: String, rarity: String, amount: u32) {
        buyer.require_auth();
        assert!(amount > 0, "amount must be > 0");

        let price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::RarityPrice(rarity.clone()))
            .expect("rarity not configured");

        let total: i128 = price.checked_mul(amount as i128).expect("overflow");

        let xlm_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::XlmToken)
            .unwrap();
        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap();

        token::Client::new(&env, &xlm_token).transfer(&buyer, &treasury, &total);

        let key = DataKey::Holdings(buyer.clone(), card_code.clone());
        let current: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
        env.storage().persistent().extend_ttl(&key, 100_000, 100_000);

        env.events().publish(
            (symbol_short!("buy"),),
            (buyer, card_code, rarity, amount, total),
        );
    }

    /// How many of a card an address holds via this contract
    pub fn get_holdings(env: Env, owner: Address, card_code: String) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Holdings(owner, card_code))
            .unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        get_admin(&env)
    }

    pub fn treasury(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .expect("not initialized")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
        vec, Env,
    };

    fn create_token(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'_>) {
        let addr = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let client = token::StellarAssetClient::new(env, &addr);
        (addr, client)
    }

    #[test]
    fn test_buy_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let buyer = Address::generate(&env);

        let (xlm_addr, xlm_admin) = create_token(&env, &admin);
        xlm_admin.mint(&buyer, &1_000_000_000_000);

        let contract_id = env.register(CardVerse, ());
        let client = CardVerseClient::new(&env, &contract_id);

        client.initialize(&admin, &treasury, &xlm_addr);

        let common_price: i128 = 100_000_000; // 10 XLM
        client.set_price(&String::from_str(&env, "Common"), &common_price);

        let code = String::from_str(&env, "PIKA");
        let rarity = String::from_str(&env, "Common");

        client.buy(&buyer, &code, &rarity, &2u32);

        assert_eq!(client.get_holdings(&buyer, &code), 2);

        let tok = token::Client::new(&env, &xlm_addr);
        assert_eq!(tok.balance(&treasury), 200_000_000);
    }
}
