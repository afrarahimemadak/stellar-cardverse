import { NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';
import cardsData from '@/data/cards.json';

const CONTRACT_ID = process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID;
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

const DUMMY_ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

async function queryHoldings(server, contract, owner, cardCode) {
  try {
    const ownerAddr = StellarSdk.Address.fromString(owner);
    const dummyAcct = new StellarSdk.Account(DUMMY_ACCOUNT, '0');

    const tx = new StellarSdk.TransactionBuilder(dummyAcct, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'get_holdings',
          StellarSdk.nativeToScVal(ownerAddr, { type: 'address' }),
          StellarSdk.xdr.ScVal.scvString(cardCode),
        ),
      )
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) return Number(StellarSdk.scValToNative(val));
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function GET(_req, { params }) {
  const { address } = params;

  if (!CONTRACT_ID) {
    return NextResponse.json({ address, holdings: [], note: 'contract not configured' });
  }

  try {
    const server = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    // Check all primary cards in parallel (batched)
    const primaryCards = cardsData.cards.filter((c) => c.primary);

    const results = await Promise.allSettled(
      primaryCards.map(async (card) => {
        const amount = await queryHoldings(server, contract, address, card.code);
        return { code: card.code, amount };
      })
    );

    const holdings = results
      .filter((r) => r.status === 'fulfilled' && r.value.amount > 0)
      .map((r) => r.value);

    return NextResponse.json({ address, holdings, contractId: CONTRACT_ID });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
