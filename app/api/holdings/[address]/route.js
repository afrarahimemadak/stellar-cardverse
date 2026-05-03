import { NextResponse } from 'next/server';
import { getServer } from '@/lib/stellar';

export async function GET(_req, { params }) {
  const address = params.address;
  const issuer = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;

  try {
    const account = await getServer().loadAccount(address);
    const holdings = account.balances
      .filter((b) => b.asset_type !== 'native' && (!issuer || b.asset_issuer === issuer))
      .map((b) => ({
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
        limit: b.limit,
      }));
    return NextResponse.json({ address, holdings });
  } catch (e) {
    if (e?.response?.status === 404) {
      return NextResponse.json({ address, holdings: [], note: 'account not found on chain' });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
