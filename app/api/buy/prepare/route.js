import { NextResponse } from 'next/server';
import cardsData from '@/data/cards.json';
import {
  StellarSdk,
  asset as makeAsset,
  buildTx,
  trustlineOp,
  buyOfferOp,
  NETWORK_PASSPHRASE,
  getServer,
} from '@/lib/stellar';

export async function POST(req) {
  try {
    const { buyer, code, amount } = await req.json();
    if (!buyer || !code || !amount) {
      return NextResponse.json({ error: 'missing buyer / code / amount' }, { status: 400 });
    }

    const card = cardsData.cards.find((c) => c.code === code);
    if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

    const issuer = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
    if (!issuer) return NextResponse.json({ error: 'issuer not configured' }, { status: 500 });

    const r = cardsData.rarities[card.rarity];
    const cardAsset = makeAsset(code, issuer);

    const server = getServer();
    const buyerAccount = await server.loadAccount(buyer);

    const ops = [];
    const hasTrust = buyerAccount.balances.some(
      (b) => b.asset_type !== 'native' && b.asset_code === code && b.asset_issuer === issuer
    );
    if (!hasTrust) {
      ops.push(trustlineOp(cardAsset, r.supply));
    }

    ops.push(buyOfferOp(cardAsset, amount, r.price));

    const tx = buildTx(buyerAccount, ops, { memo: `buy-${code}-${amount}` });

    return NextResponse.json({
      xdr: tx.toXDR(),
      networkPassphrase: NETWORK_PASSPHRASE,
      addedTrustline: !hasTrust,
      pricePerUnit: r.price,
      total: r.price * Number(amount),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
