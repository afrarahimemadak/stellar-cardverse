import { NextResponse } from 'next/server';
import { StellarSdk, getServer, NETWORK_PASSPHRASE } from '@/lib/stellar';

export async function POST(req) {
  try {
    const { xdr } = await req.json();
    if (!xdr) return NextResponse.json({ error: 'xdr missing' }, { status: 400 });

    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    const res = await getServer().submitTransaction(tx);
    return NextResponse.json({ hash: res.hash, ledger: res.ledger });
  } catch (e) {
    const detail = e?.response?.data?.extras?.result_codes
      ? JSON.stringify(e.response.data.extras.result_codes)
      : e.message;
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
