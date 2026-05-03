#!/usr/bin/env node
/**
 * Mints all cards from data/cards.json on Stellar testnet.
 *
 * For each card:
 *   1. Distributor establishes trustline to the asset (limit = total supply)
 *   2. Issuer pays full supply to the distributor
 *   3. Distributor publishes a sell offer on the DEX at the rarity's XLM price
 *
 * Operations are batched per source account (Stellar allows up to 100 ops/tx).
 * Idempotent: skips work that's already on-chain (existing trustlines, balances, offers).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  StellarSdk,
  getServer,
  asset: makeAsset,
  buildTx,
  submitSignedTx,
  trustlineOp,
  paymentOp,
  sellOfferOp,
} = require('../lib/stellar');

const CARDS = require('../data/cards.json');
const OPS_PER_TX = 50;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function rarityInfo(card) {
  const r = CARDS.rarities[card.rarity];
  if (!r) throw new Error(`Unknown rarity ${card.rarity} on card ${card.code}`);
  return r;
}

async function submit(sourceKeypair, ops, label) {
  const server = getServer();
  const account = await server.loadAccount(sourceKeypair.publicKey());
  const tx = buildTx(account, ops);
  tx.sign(sourceKeypair);
  try {
    const res = await submitSignedTx(tx);
    console.log(`  ✓ ${label} — hash ${res.hash}`);
    return res;
  } catch (e) {
    const detail = e.response && e.response.data && e.response.data.extras
      ? JSON.stringify(e.response.data.extras.result_codes)
      : e.message;
    throw new Error(`${label} failed: ${detail}`);
  }
}

async function main() {
  const issuerSecret = process.env.ISSUER_SECRET;
  const distSecret = process.env.DISTRIBUTOR_SECRET;
  if (!issuerSecret || !distSecret) {
    throw new Error('ISSUER_SECRET / DISTRIBUTOR_SECRET missing — run `npm run setup` first');
  }

  const issuer = StellarSdk.Keypair.fromSecret(issuerSecret);
  const dist = StellarSdk.Keypair.fromSecret(distSecret);

  const server = getServer();
  const distAccount = await server.loadAccount(dist.publicKey());

  const existingBalances = new Set(
    distAccount.balances
      .filter((b) => b.asset_type !== 'native')
      .map((b) => `${b.asset_code}:${b.asset_issuer}`)
  );

  const offersResp = await server.offers().forAccount(dist.publicKey()).limit(200).call();
  const existingOffers = new Set(
    offersResp.records.map((o) => `${o.selling.asset_code}:${o.selling.asset_issuer}`)
  );

  console.log(`Issuer:      ${issuer.publicKey()}`);
  console.log(`Distributor: ${dist.publicKey()}`);
  console.log(`Cards:       ${CARDS.cards.length}\n`);

  // ---- Round 1: trustlines (distributor) ----
  const trustlineCards = CARDS.cards.filter(
    (c) => !existingBalances.has(`${c.code}:${issuer.publicKey()}`)
  );
  console.log(`Round 1/3 — trustlines for ${trustlineCards.length} new card(s)`);
  for (const batch of chunk(trustlineCards, OPS_PER_TX)) {
    const ops = batch.map((c) =>
      trustlineOp(makeAsset(c.code, issuer.publicKey()), rarityInfo(c).supply)
    );
    if (!ops.length) continue;
    await submit(dist, ops, `  trustlines [${batch.map((c) => c.code).join(', ')}]`);
  }

  // ---- Round 2: payments (issuer → distributor) ----
  // Re-read distributor balances to know how much is already credited.
  const refreshed = await server.loadAccount(dist.publicKey());
  const balanceMap = new Map();
  for (const b of refreshed.balances) {
    if (b.asset_type !== 'native') {
      balanceMap.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }

  const paymentCards = CARDS.cards.filter((c) => {
    const have = balanceMap.get(`${c.code}:${issuer.publicKey()}`) || 0;
    return have < rarityInfo(c).supply;
  });
  console.log(`\nRound 2/3 — payments for ${paymentCards.length} card(s)`);
  for (const batch of chunk(paymentCards, OPS_PER_TX)) {
    const ops = batch.map((c) => {
      const have = balanceMap.get(`${c.code}:${issuer.publicKey()}`) || 0;
      const owed = rarityInfo(c).supply - have;
      return paymentOp(makeAsset(c.code, issuer.publicKey()), dist.publicKey(), owed);
    });
    if (!ops.length) continue;
    await submit(issuer, ops, `  payments [${batch.map((c) => c.code).join(', ')}]`);
  }

  // ---- Round 3: sell offers (distributor) ----
  const offerCards = CARDS.cards.filter(
    (c) => !existingOffers.has(`${c.code}:${issuer.publicKey()}`)
  );
  console.log(`\nRound 3/3 — sell offers for ${offerCards.length} card(s)`);
  for (const batch of chunk(offerCards, OPS_PER_TX)) {
    const ops = batch.map((c) => {
      const r = rarityInfo(c);
      return sellOfferOp(makeAsset(c.code, issuer.publicKey()), r.supply, r.price);
    });
    if (!ops.length) continue;
    await submit(dist, ops, `  offers [${batch.map((c) => c.code).join(', ')}]`);
  }

  console.log('\nMint complete. Inspect on https://stellar.expert/explorer/testnet/account/' + dist.publicKey());
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
