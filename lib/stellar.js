/**
 * Stellar utility helpers — works in both Node (scripts) and browser (Next.js client).
 *
 * Designed around classic Stellar Assets + the built-in DEX.
 * Each card = one Asset issued by ISSUER, distributed via DISTRIBUTOR.
 */

const StellarSdk = require('@stellar/stellar-sdk');

const NETWORK_PASSPHRASE =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE) ||
  StellarSdk.Networks.TESTNET;

const HORIZON_URL =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_HORIZON_URL) ||
  'https://horizon-testnet.stellar.org';

function getServer() {
  return new StellarSdk.Horizon.Server(HORIZON_URL);
}

function asset(code, issuer) {
  return new StellarSdk.Asset(code, issuer);
}

/** Friendbot funding for testnet only. */
async function fundWithFriendbot(publicKey) {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status} ${text}`);
  }
  return res.json();
}

async function loadAccount(publicKey) {
  return getServer().loadAccount(publicKey);
}

function buildTx(sourceAccount, operations, { memo, timeout = 180 } = {}) {
  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of operations) builder.addOperation(op);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  builder.setTimeout(timeout);
  return builder.build();
}

async function submitSignedTx(tx) {
  return getServer().submitTransaction(tx);
}

/** Create a trustline from `account` to `cardAsset` with the given limit. */
function trustlineOp(cardAsset, limit) {
  return StellarSdk.Operation.changeTrust({
    asset: cardAsset,
    limit: String(limit),
  });
}

/** Issuer pays N units of the card asset to the destination. */
function paymentOp(cardAsset, destination, amount) {
  return StellarSdk.Operation.payment({
    destination,
    asset: cardAsset,
    amount: String(amount),
  });
}

/** Distributor offers to sell `amount` units of the card asset for XLM at `price` per unit. */
function sellOfferOp(cardAsset, amount, price) {
  return StellarSdk.Operation.manageSellOffer({
    selling: cardAsset,
    buying: StellarSdk.Asset.native(),
    amount: String(amount),
    price: String(price),
    offerId: '0',
  });
}

/** Buyer offers to buy a card with XLM. Used by the marketplace buy flow. */
function buyOfferOp(cardAsset, amount, price) {
  return StellarSdk.Operation.manageBuyOffer({
    selling: StellarSdk.Asset.native(),
    buying: cardAsset,
    buyAmount: String(amount),
    price: String(price),
    offerId: '0',
  });
}

/** Lock the issuer so total supply can never grow. Used after the initial mint. */
function lockIssuerOp() {
  return StellarSdk.Operation.setOptions({ masterWeight: 0 });
}

module.exports = {
  StellarSdk,
  NETWORK_PASSPHRASE,
  HORIZON_URL,
  getServer,
  asset,
  fundWithFriendbot,
  loadAccount,
  buildTx,
  submitSignedTx,
  trustlineOp,
  paymentOp,
  sellOfferOp,
  buyOfferOp,
  lockIssuerOp,
};
