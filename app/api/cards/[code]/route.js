import { NextResponse } from 'next/server';
import cardsData from '@/data/cards.json';
import { getServer } from '@/lib/stellar';

export async function GET(_req, { params }) {
  const card = cardsData.cards.find((c) => c.code === params.code);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const issuer = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
  if (!issuer) {
    return NextResponse.json({
      card,
      rarity: cardsData.rarities[card.rarity],
      issuer: null,
      offers: [],
      note: 'issuer not configured — run npm run setup',
    });
  }

  try {
    const server = getServer();
    const offersResp = await server
      .offers()
      .selling({ code: card.code, issuer })
      .limit(50)
      .call();

    return NextResponse.json({
      card,
      rarity: cardsData.rarities[card.rarity],
      issuer,
      offers: offersResp.records.map((o) => ({
        id: o.id,
        seller: o.seller,
        amount: o.amount,
        price: o.price,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
