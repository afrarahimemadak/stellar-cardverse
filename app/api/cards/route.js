import { NextResponse } from 'next/server';
import cardsData from '@/data/cards.json';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    issuer: process.env.NEXT_PUBLIC_ISSUER_PUBLIC || null,
    distributor: process.env.NEXT_PUBLIC_DISTRIBUTOR_PUBLIC || null,
    rarities: cardsData.rarities,
    cards: cardsData.cards,
  });
}
