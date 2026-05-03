'use client';

import { useState, useMemo } from 'react';
import { useWallet } from './WalletProvider';
import { signWithFreighter } from '@/lib/freighter';

export default function BuyBox({ card, price, supply }) {
  const { address, networkPassphrase, connect } = useWallet();
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => Number(qty) * price, [qty, price]);

  async function buy() {
    setStatus(null);
    setBusy(true);
    try {
      if (!address) {
        await connect();
        setBusy(false);
        return;
      }

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

      setStatus({
        kind: 'success',
        msg: `Başarılı! Hash: ${submitData.hash.slice(0, 12)}…`,
        hash: submitData.hash,
      });
    } catch (e) {
      setStatus({ kind: 'error', msg: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="buy-box">
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
        </div>
      )}
    </div>
  );
}
