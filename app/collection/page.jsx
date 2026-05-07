'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletProvider';
import cardsData from '@/data/cards.json';

const HAS_CONTRACT = !!process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CARDVERSE_CONTRACT_ID || '';

export default function Collection() {
  const { address, connect } = useWallet();
  const [classicHoldings, setClassicHoldings] = useState(null);
  const [contractHoldings, setContractHoldings] = useState(null);
  const [tab, setTab] = useState('classic');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;
    setError(null);

    // Classic Horizon holdings
    fetch(`/api/holdings/${address}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, body: j })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || 'holdings fetch failed');
        setClassicHoldings(body.holdings || []);
      })
      .catch((e) => setError(e.message));

    // Soroban contract holdings (only if contract is configured)
    if (HAS_CONTRACT) {
      fetch(`/api/holdings/${address}/soroban`)
        .then((r) => r.json())
        .then((data) => setContractHoldings(data.holdings || []))
        .catch(() => setContractHoldings([]));
    }
  }, [address]);

  if (!address) {
    return (
      <main className="container">
        <h1 className="section-title">Koleksiyonum</h1>
        <div className="empty">
          Koleksiyonunu görmek için cüzdanını bağla.
          <div style={{ marginTop: 16 }}>
            <button className="cta" onClick={connect}>Cüzdanı Bağla</button>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <h1 className="section-title">Koleksiyonum</h1>
        <div className="empty">Hata: {error}</div>
      </main>
    );
  }

  if (!classicHoldings) {
    return (
      <main className="container">
        <h1 className="section-title">Koleksiyonum</h1>
        <div className="empty">Yükleniyor…</div>
      </main>
    );
  }

  const cardByCode = new Map(cardsData.cards.map((c) => [c.code, c]));

  const classicOwned = classicHoldings
    .map((h) => ({ ...h, card: cardByCode.get(h.code) }))
    .filter((h) => h.card && Number(h.balance) > 0);

  const contractOwned = (contractHoldings || [])
    .map((h) => ({ ...h, card: cardByCode.get(h.code) }))
    .filter((h) => h.card && h.amount > 0);

  const currentList = tab === 'contract' ? contractOwned : classicOwned;

  return (
    <main className="container">
      <h1 className="section-title">Koleksiyonum</h1>
      <p>Adres: <code style={{ fontSize: 11 }}>{address}</code></p>

      {HAS_CONTRACT && (
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <button
            className={`filter-btn ${tab === 'classic' ? 'active' : ''}`}
            onClick={() => setTab('classic')}
          >
            Stellar Assets ({classicOwned.length})
          </button>
          <button
            className={`filter-btn ${tab === 'contract' ? 'active' : ''}`}
            onClick={() => setTab('contract')}
          >
            Soroban Kontrat ({contractOwned.length})
          </button>
        </div>
      )}

      {tab === 'contract' && HAS_CONTRACT && (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 16px' }}>
          On-chain sahiplik kayıtları:{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-card)' }}
          >
            Kontratı görüntüle
          </a>
        </p>
      )}

      {currentList.length === 0 ? (
        <div className="empty">
          {tab === 'contract'
            ? 'Bu adrese ait kontrat kaydı yok. "Smart Contract" modunda kart satın al.'
            : <>Henüz kartın yok. <Link href="/marketplace">Marketplace'e gidip</Link> ilkini al.</>}
        </div>
      ) : (
        <div className="grid">
          {currentList.map((h) => {
            const card = h.card;
            const r = cardsData.rarities[card.rarity];
            const rarityClass = `rarity-${card.rarity.toLowerCase()}`;
            const qty = tab === 'contract' ? h.amount : Number(h.balance);
            return (
              <Link key={card.code} href={`/card/${card.code}`} className="card">
                <div className="card-image">{card.name}</div>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="card-name">{card.name}</span>
                    <span className={`rarity-badge ${rarityClass}`}>{card.rarity}</span>
                  </div>
                  <p className="card-meta">{card.category} · {card.series}</p>
                  <div className="price-row">
                    <span>Sahip olunan</span>
                    <strong>{qty.toLocaleString()} adet</strong>
                  </div>
                  {tab === 'contract' && (
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                      On-chain doğrulandı
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
