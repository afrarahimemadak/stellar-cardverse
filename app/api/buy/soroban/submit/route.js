import { NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

export async function POST(req) {
  try {
    const { xdr } = await req.json();
    if (!xdr) return NextResponse.json({ error: 'missing xdr' }, { status: 400 });

    const server = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

    const result = await server.sendTransaction(tx);

    if (result.status === 'ERROR') {
      return NextResponse.json({ error: result.errorResult || 'transaction failed' }, { status: 400 });
    }

    // Poll for confirmation
    const hash = result.hash;
    let attempts = 0;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 2000));
      const txResult = await server.getTransaction(hash);
      if (txResult.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        return NextResponse.json({ hash, status: 'success' });
      }
      if (txResult.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
        return NextResponse.json({ error: 'transaction failed on-chain', hash }, { status: 400 });
      }
      attempts++;
    }

    return NextResponse.json({ hash, status: 'pending' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
