/**
 * Soroban CardVerse contract client.
 * Works in both browser (Next.js) and Node.js.
 *
 * Contract functions:
 *   initialize(admin, treasury, xlm_token)
 *   set_price(rarity, price)        — admin only
 *   get_price(rarity)               → i128 (stroops)
 *   buy(buyer, card_code, rarity, amount)
 *   get_holdings(owner, card_code)  → u32
 *   admin()                         → Address
 *   treasury()                      → Address
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const CONTRACT_ID = process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID || '';
const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

// 1 XLM = 10_000_000 stroops
const XLM_TO_STROOPS = 10_000_000n;

const RARITY_PRICES_XLM = {
  Common: 10n,
  Rare: 50n,
  Epic: 150n,
  Legendary: 500n,
};

export function getRpcServer() {
  return new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });
}

export function getContractId() {
  if (!CONTRACT_ID) throw new Error('NEXT_PUBLIC_CARDVERSE_CONTRACT_ID not set');
  return CONTRACT_ID;
}

/** Convert XLM amount to stroops (BigInt) */
export function xlmToStroops(xlm) {
  return BigInt(xlm) * XLM_TO_STROOPS;
}

/** Expected price in XLM for a rarity (for display) */
export function rarityPriceXlm(rarity) {
  return Number(RARITY_PRICES_XLM[rarity] || 0n);
}

/**
 * Build a Soroban transaction that calls `cardverse.buy`.
 * Returns the assembled (but unsigned) transaction XDR.
 *
 * @param {string} buyer   - Stellar public key of the buyer
 * @param {string} code    - Card code e.g. "PIKA"
 * @param {string} rarity  - "Common" | "Rare" | "Epic" | "Legendary"
 * @param {number} amount  - quantity (integer ≥ 1)
 */
export async function buildBuyTx(buyer, code, rarity, amount) {
  const server = getRpcServer();
  const contractId = getContractId();

  const account = await server.getAccount(buyer);

  const contract = new StellarSdk.Contract(contractId);

  const buyerAddr = StellarSdk.Address.fromString(buyer);
  const cardCode = StellarSdk.xdr.ScVal.scvString(code);
  const rarityVal = StellarSdk.xdr.ScVal.scvString(rarity);
  const amountVal = StellarSdk.nativeToScVal(amount, { type: 'u32' });

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'buy',
        StellarSdk.nativeToScVal(buyerAddr, { type: 'address' }),
        cardCode,
        rarityVal,
        amountVal,
      ),
    )
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * Query the contract for how many of a card an address holds.
 * Returns 0 if not found.
 */
export async function getHoldings(owner, code) {
  const server = getRpcServer();
  const contractId = getContractId();

  try {
    const contract = new StellarSdk.Contract(contractId);

    const ownerAddr = StellarSdk.Address.fromString(owner);
    const cardCode = StellarSdk.xdr.ScVal.scvString(code);

    const result = await server.simulateTransaction(
      new StellarSdk.TransactionBuilder(
        await server.getAccount(owner),
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE },
      )
        .addOperation(
          contract.call(
            'get_holdings',
            StellarSdk.nativeToScVal(ownerAddr, { type: 'address' }),
            cardCode,
          ),
        )
        .setTimeout(30)
        .build(),
    );

    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) return StellarSdk.scValToNative(val);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Query the XLM price for a rarity tier (returns stroops as BigInt).
 */
export async function getContractPrice(rarity) {
  const server = getRpcServer();
  const contractId = getContractId();

  try {
    const contract = new StellarSdk.Contract(contractId);

    // Use a dummy account for read-only simulation
    const dummyAcct = new StellarSdk.Account(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      '0',
    );

    const result = await server.simulateTransaction(
      new StellarSdk.TransactionBuilder(dummyAcct, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call('get_price', StellarSdk.xdr.ScVal.scvString(rarity)),
        )
        .setTimeout(30)
        .build(),
    );

    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) return BigInt(StellarSdk.scValToNative(val));
    }
  } catch {}

  // Fallback to hardcoded prices
  return (RARITY_PRICES_XLM[rarity] || 0n) * XLM_TO_STROOPS;
}
