'use client';

import { useState, useMemo } from 'react';
import { useWallet } from './WalletProvider';
import { signWithFreighter } from '@/lib/freighter';

const HAS_CONTRACT = !!process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID;

export default function BuyBox({ card, price, supply }) {
  const { address, networkPassphrase, connect } = useWallet();
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState(HAS_CONTRACT ? 'soroban' : 'classic');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => Number(qty) * price, [qty, price]);

  async function buyClassic() {
    const prep = await fetch('/api/buy/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer: address, code: card.code, amount: Number(qty) }),
    });
    const prepData = await prep.json();
    if (!prep.ok) throw new Error(prepData.error || 'prepare failed');

    const passphrase = networkPassphrase || prepData.networkPassphrase;
    const signed = await signWithFreighter(prepData.xdr, passphrase, address);

    const submit = await fetch('/api/buy/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xdr: signed }),
    });
    const submitData = await submit.json();
    if (!submit.ok) throw new Error(submitData.error || 'submit failed');
    return submitData.hash;
  }

  async function buySoroban() {
    const prep = await fetch('/api/buy/soroban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer: address, code: card.code, amount: Number(qty) }),
    });
    const prepData = await prep.json();
    if (!prep.ok) throw new Error(prepData.error || 'soroban prepare failed');

    const passphrase = networkPassphrase || prepData.networkPassphrase;
    const signed = await signWithFreighter(prepData.xdr, passphrase, address);

    const submit = await fetch('/api/buy/soroban/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xdr: signed }),
    });
    const submitData = await submit.json();
    if (!submit.ok) throw new Error(submitData.error || 'soroban submit failed');
    return submitData.hash;
  }

  async function buy() {
    setStatus(null);
    setBusy(true);
    try {
      if (!address) {
        await connect();
        setBusy(false);
        return;
      }

      const hash = mode === 'soroban' ? await buySoroban() : await buyClassic();

      setStatus({
        kind: 'success',
        msg: `Başarılı! Hash: ${hash.slice(0, 12)}…`,
        hash,
        mode,
      });
    } catch (e) {
      setStatus({ kind: 'error', msg: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  const explorerBase =
    mode === 'soroban'
      ? 'https://stellar.expert/explorer/testnet/contract-call'
      : 'https://stellar.expert/explorer/testnet/tx';

  return (
    <div className="buy-box">
      {HAS_CONTRACT && (
        <div className="mode-toggle" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button
            className={`filter-btn ${mode === 'soroban' ? 'active' : ''}`}
            onClick={() => setMode('soroban')}
            title="Soroban smart contract üzerinden satın al"
          >
            Smart Contract
          </button>
          <button
            className={`filter-btn ${mode === 'classic' ? 'active' : ''}`}
            onClick={() => setMode('classic')}
            title="Klasik Stellar DEX üzerinden satın al"
          >
            Klasik DEX
          </button>
        </div>
      )}

      {mode === 'soroban' && HAS_CONTRACT && (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
          Sahiplik Soroban akıllı kontratında on-chain kayıt edilir.
        </p>
      )}

      <label>Adet (toplam supply: {supply})</label>
      <input
        type="number"
        min={1}
        max={supply}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        disabled={busy}
      />
      <div className="total">Toplam: {total} XLM</div>
      <button onClick={buy} disabled={busy}>
        {busy
          ? 'İşleniyor…'
          : address
          ? `Satın Al (${total} XLM)`
          : 'Satın Almak için Cüzdanı Bağla'}
      </button>
      {status && (
        <div className={`status ${status.kind}`}>
          {status.msg}
          {status.hash && (
            <>
              {' '}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${status.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                explorer
              </a>
            </>
          )}
          {status.mode === 'soroban' && (
            <>
              {' '}
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID}`}
                target="_blank"
                rel="noreferrer"
              >
                kontrat
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
