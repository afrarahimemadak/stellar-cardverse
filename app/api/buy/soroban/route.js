import { NextResponse } from 'next/server';
import cardsData from '@/data/cards.json';

export async function POST(req) {
  try {
    const { buyer, code, amount } = await req.json();
    if (!buyer || !code || !amount) {
      return NextResponse.json({ error: 'missing buyer / code / amount' }, { status: 400 });
    }

    const card = cardsData.cards.find((c) => c.code === code);
    if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

    const contractId = process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json({ error: 'contract not deployed yet' }, { status: 503 });
    }

    const { buildBuyTx } = await import('@/lib/soroban');
    const xdr = await buildBuyTx(buyer, code, card.rarity, Number(amount));

    const rarity = cardsData.rarities[card.rarity];

    return NextResponse.json({
      xdr,
      contractId,
      networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
      rarity: card.rarity,
      pricePerUnit: rarity.price,
      total: rarity.price * Number(amount),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
