#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Verifies that:
 *   - Issuer + distributor accounts exist on testnet
 *   - Distributor holds the full supply of every card asset
 *   - A live sell offer exists for every card
 *   - The buy-prepare logic produces a valid XDR for a synthetic buyer
 *
 * Run AFTER `npm run setup` and `npm run mint`.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  StellarSdk,
  getServer,
  asset: makeAsset,
  buildTx,
  trustlineOp,
  buyOfferOp,
  fundWithFriendbot,
  NETWORK_PASSPHRASE,
} = require('../lib/stellar');

const CARDS = require('../data/cards.json');

let pass = 0;
let fail = 0;
function check(label, ok, info = '') {
  if (ok) {
    console.log(`  PASS  ${label}${info ? ' — ' + info : ''}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}${info ? ' — ' + info : ''}`);
    fail++;
  }
}

async function main() {
  const issuerPub = process.env.ISSUER_PUBLIC;
  const distPub = process.env.DISTRIBUTOR_PUBLIC;
  if (!issuerPub || !distPub) throw new Error('Run `npm run setup` and `npm run mint` first.');

  const server = getServer();

  console.log('\n[1/4] Account existence');
  const issuerAcct = await server.loadAccount(issuerPub).catch(() => null);
  check('issuer account loaded', !!issuerAcct, issuerPub);
  const distAcct = await server.loadAccount(distPub).catch(() => null);
  check('distributor account loaded', !!distAcct, distPub);
  if (!issuerAcct || !distAcct) {
    console.log('\nCannot continue without both accounts.');
    process.exit(1);
  }

  console.log('\n[2/4] Distributor balances per card');
  const balanceMap = new Map();
  for (const b of distAcct.balances) {
    if (b.asset_type !== 'native') {
      balanceMap.set(`${b.asset_code}:${b.asset_issuer}`, parseFloat(b.balance));
    }
  }
  for (const c of CARDS.cards) {
    const expected = CARDS.rarities[c.rarity].supply;
    const have = balanceMap.get(`${c.code}:${issuerPub}`) || 0;
    check(`${c.code} balance == ${expected}`, have === expected, `actual ${have}`);
  }

  console.log('\n[3/4] Sell offers on DEX');
  const offers = await server.offers().forAccount(distPub).limit(200).call();
  const offerMap = new Map();
  for (const o of offers.records) {
    if (o.selling.asset_code) {
      offerMap.set(`${o.selling.asset_code}:${o.selling.asset_issuer}`, o);
    }
  }
  for (const c of CARDS.cards) {
    const expected = CARDS.rarities[c.rarity].price;
    const o = offerMap.get(`${c.code}:${issuerPub}`);
    if (!o) {
      check(`${c.code} sell offer exists`, false);
      continue;
    }
    const priceMatches = Math.abs(parseFloat(o.price) - expected) < 0.0001;
    check(`${c.code} sell offer @ ${expected} XLM`, priceMatches, `actual ${o.price}, amount ${o.amount}`);
  }

  console.log('\n[4/4] Synthetic buyer — prepare XDR');
  const buyer = StellarSdk.Keypair.random();
  console.log(`  buyer: ${buyer.publicKey()}`);
  await fundWithFriendbot(buyer.publicKey());
  const buyerAcct = await server.loadAccount(buyer.publicKey());
  const sample = CARDS.cards[0];
  const sampleAsset = makeAsset(sample.code, issuerPub);
  const tx = buildTx(buyerAcct, [
    trustlineOp(sampleAsset, CARDS.rarities[sample.rarity].supply),
    buyOfferOp(sampleAsset, 1, CARDS.rarities[sample.rarity].price),
  ]);
  tx.sign(buyer);
  try {
    const res = await server.submitTransaction(tx);
    check(`buyer trust + buy-offer for ${sample.code}`, true, `hash ${res.hash}`);
  } catch (e) {
    const detail = e?.response?.data?.extras?.result_codes;
    check(`buyer trust + buy-offer for ${sample.code}`, false, JSON.stringify(detail || e.message));
  }

  // Allow a couple of seconds for ledger settle, then check buyer balance.
  await new Promise((r) => setTimeout(r, 4000));
  const buyerAfter = await server.loadAccount(buyer.publicKey());
  const sampleBal = buyerAfter.balances.find(
    (b) => b.asset_type !== 'native' && b.asset_code === sample.code
  );
  check(`buyer received ${sample.code}`, !!sampleBal && parseFloat(sampleBal.balance) > 0, sampleBal ? `balance ${sampleBal.balance}` : 'no balance');

  console.log(`\nResult: ${pass} pass, ${fail} fail`);
  console.log(`Issuer:      https://stellar.expert/explorer/testnet/account/${issuerPub}`);
  console.log(`Distributor: https://stellar.expert/explorer/testnet/account/${distPub}`);
  console.log(`Test buyer:  https://stellar.expert/explorer/testnet/account/${buyer.publicKey()}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
