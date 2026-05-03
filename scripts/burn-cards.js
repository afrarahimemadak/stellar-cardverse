#!/usr/bin/env node
/**
 * Removes one or more card assets from the chain (distributor + issuer).
 *
 * For each given asset code:
 *   1. Distributor cancels the open sell offer
 *   2. Distributor sends remaining balance back to the issuer (burn)
 *   3. Distributor closes the trustline (frees up the 0.5 XLM reserve)
 *
 * Usage:
 *   node scripts/burn-cards.js MESSI RONALDO MBAPPE ...
 *
 * Safe to re-run: each step is conditional on current chain state.
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

const codes = process.argv.slice(2);
if (!codes.length) {
  console.error('Usage: node scripts/burn-cards.js CODE1 CODE2 ...');
  process.exit(1);
}

async function submit(label, signer, ops) {
  const server = getServer();
  const account = await server.loadAccount(signer.publicKey());
  const tx = buildTx(account, ops);
  tx.sign(signer);
  try {
    const res = await submitSignedTx(tx);
    console.log(`  ✓ ${label} — hash ${res.hash}`);
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

  const distAccount = await server.loadAccount(dist.publicKey());
  const balances = new Map();
  for (const b of distAccount.balances) {
    if (b.asset_type !== 'native') {
      balances.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }

  const offersResp = await server.offers().forAccount(dist.publicKey()).limit(200).call();
  const offerIdByKey = new Map();
  for (const o of offersResp.records) {
    if (o.selling.asset_code) {
      offerIdByKey.set(`${o.selling.asset_code}:${o.selling.asset_issuer}`, o.id);
    }
  }

  console.log(`Burning ${codes.length} card(s) for distributor ${dist.publicKey()}\n`);

  // Round 1: cancel offers + send balance back to issuer (burn) ----------
  const round1Ops = [];
  for (const code of codes) {
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
      console.log(`  ${code}: offer ${offerId} -> cancel`);
    } else {
      console.log(`  ${code}: no open offer`);
    }

    const bal = balances.get(key) || 0;
    if (bal > 0) {
      round1Ops.push(StellarSdk.Operation.payment({
        destination: issuer.publicKey(),
        asset: a,
        amount: String(bal),
      }));
      console.log(`  ${code}: balance ${bal} -> burn`);
    } else {
      console.log(`  ${code}: balance already 0`);
    }
  }
  if (round1Ops.length) {
    await submit('Round 1 (cancel + burn)', dist, round1Ops);
  } else {
    console.log('  (nothing to do)');
  }

  // Round 2: close trustlines ----------------------------------------------
  // Re-read distributor to confirm balances are zero before removing trustlines.
  const refreshed = await server.loadAccount(dist.publicKey());
  const balanceNow = new Map();
  for (const b of refreshed.balances) {
    if (b.asset_type !== 'native') {
      balanceNow.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }
  const round2Ops = [];
  for (const code of codes) {
    const key = `${code}:${issuer.publicKey()}`;
    if (!balanceNow.has(key)) {
      console.log(`  ${code}: no trustline`);
      continue;
    }
    if ((balanceNow.get(key) || 0) > 0) {
      console.log(`  ${code}: balance still > 0, skipping trustline close`);
      continue;
    }
    round2Ops.push(StellarSdk.Operation.changeTrust({
      asset: makeAsset(code, issuer.publicKey()),
      limit: '0',
    }));
  }
  if (round2Ops.length) {
    await submit('Round 2 (close trustlines)', dist, round2Ops);
  } else {
    console.log('\n  (nothing to do for trustlines)');
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
