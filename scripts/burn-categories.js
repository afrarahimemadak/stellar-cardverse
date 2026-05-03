#!/usr/bin/env node
/**
 * Burns every card in one or more categories from the chain.
 *
 * For each card in the targeted categories:
 *   1. Cancel the distributor's open sell offer (if any)
 *   2. Send the distributor's remaining balance back to the issuer (burn)
 *   3. Close the trustline (frees the 0.5 XLM reserve)
 *
 * Operations are batched into multiple transactions (max 80 ops/tx)
 * because Stellar caps each transaction at 100 ops.
 *
 * Usage:
 *   node scripts/burn-categories.js LoL Anime
 *
 * Idempotent: skips work that's already been done.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  StellarSdk,
  getServer,
  asset: makeAsset,
  buildTx,
  submitSignedTx,
} = require('../lib/stellar');

const CARDS = require('../data/cards.json');
const OPS_PER_TX = 80;

const targetCategories = process.argv.slice(2);
if (!targetCategories.length) {
  console.error('Usage: node scripts/burn-categories.js Category1 Category2 ...');
  process.exit(1);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function submit(label, signer, ops) {
  const server = getServer();
  const account = await server.loadAccount(signer.publicKey());
  const tx = buildTx(account, ops);
  tx.sign(signer);
  try {
    const res = await submitSignedTx(tx);
    console.log(`  ✓ ${label} (${ops.length} ops) — hash ${res.hash}`);
    return res;
  } catch (e) {
    const detail = e?.response?.data?.extras?.result_codes
      ? JSON.stringify(e.response.data.extras.result_codes)
      : e.message;
    throw new Error(`${label} failed: ${detail}`);
  }
}

async function main() {
  const issuer = StellarSdk.Keypair.fromSecret(process.env.ISSUER_SECRET);
  const dist = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTOR_SECRET);
  const server = getServer();

  const targetCodes = CARDS.cards
    .filter((c) => targetCategories.includes(c.category))
    .map((c) => c.code);
  console.log(`Categories: ${targetCategories.join(', ')}`);
  console.log(`Cards to burn: ${targetCodes.length}\n`);

  const distAccount = await server.loadAccount(dist.publicKey());
  const balanceMap = new Map();
  for (const b of distAccount.balances) {
    if (b.asset_type !== 'native') {
      balanceMap.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }

  const offerIdByKey = new Map();
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const q = server.offers().forAccount(dist.publicKey()).limit(200);
    if (cursor) q.cursor(cursor);
    const resp = await q.call();
    if (!resp.records.length) break;
    for (const o of resp.records) {
      if (o.selling.asset_code) {
        offerIdByKey.set(`${o.selling.asset_code}:${o.selling.asset_issuer}`, o.id);
      }
      cursor = o.paging_token;
    }
    if (resp.records.length < 200) break;
  }

  // Round 1: cancel offers + burn balances ----------
  const round1Ops = [];
  for (const code of targetCodes) {
    const key = `${code}:${issuer.publicKey()}`;
    const a = makeAsset(code, issuer.publicKey());

    const offerId = offerIdByKey.get(key);
    if (offerId) {
      round1Ops.push(StellarSdk.Operation.manageSellOffer({
        selling: a,
        buying: StellarSdk.Asset.native(),
        amount: '0',
        price: '1',
        offerId,
      }));
    }

    const bal = balanceMap.get(key) || 0;
    if (bal > 0) {
      round1Ops.push(StellarSdk.Operation.payment({
        destination: issuer.publicKey(),
        asset: a,
        amount: String(bal),
      }));
    }
  }
  console.log(`Round 1 (cancel + burn): ${round1Ops.length} total ops`);
  for (const [i, batch] of chunk(round1Ops, OPS_PER_TX).entries()) {
    await submit(`  batch ${i + 1}`, dist, batch);
  }

  // Round 2: close trustlines ----------
  const refreshed = await server.loadAccount(dist.publicKey());
  const balanceNow = new Map();
  for (const b of refreshed.balances) {
    if (b.asset_type !== 'native') {
      balanceNow.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }
  const round2Ops = [];
  for (const code of targetCodes) {
    const key = `${code}:${issuer.publicKey()}`;
    if (!balanceNow.has(key)) continue; // no trustline
    if ((balanceNow.get(key) || 0) > 0) {
      console.log(`  ${code}: balance still > 0, skipping trustline close`);
      continue;
    }
    round2Ops.push(StellarSdk.Operation.changeTrust({
      asset: makeAsset(code, issuer.publicKey()),
      limit: '0',
    }));
  }
  console.log(`\nRound 2 (close trustlines): ${round2Ops.length} total ops`);
  for (const [i, batch] of chunk(round2Ops, OPS_PER_TX).entries()) {
    await submit(`  batch ${i + 1}`, dist, batch);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
