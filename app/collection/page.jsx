'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletProvider';
import cardsData from '@/data/cards.json';

export default function Collection() {
  const { address, connect } = useWallet();
  const [holdings, setHoldings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;
    setError(null);
    fetch(`/api/holdings/${address}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, body: j })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || 'holdings fetch failed');
        setHoldings(body.holdings || []);
      })
      .catch((e) => setError(e.message));
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

  if (!holdings) {
    return (
      <main className="container">
        <h1 className="section-title">Koleksiyonum</h1>
        <div className="empty">Yükleniyor…</div>
      </main>
    );
  }

  const cardByCode = new Map(cardsData.cards.map((c) => [c.code, c]));
  const owned = holdings
    .map((h) => ({ ...h, card: cardByCode.get(h.code) }))
    .filter((h) => h.card && Number(h.balance) > 0);

  return (
    <main className="container">
      <h1 className="section-title">Koleksiyonum</h1>
      <p>Adres: <code>{address}</code></p>
      {owned.length === 0 ? (
        <div className="empty">
          Henüz kartın yok. <Link href="/marketplace">Marketplace'e gidip</Link> ilkini al.
        </div>
      ) : (
        <div className="grid">
          {owned.map((h) => {
            const card = h.card;
            const r = cardsData.rarities[card.rarity];
            const rarityClass = `rarity-${card.rarity.toLowerCase()}`;
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
                    <strong>{Number(h.balance).toLocaleString()} adet</strong>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
