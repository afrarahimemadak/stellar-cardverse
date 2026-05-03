'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import cardsData from '@/data/cards.json';
import CardTile from '@/components/CardTile';

const CATS = ['Hepsi', 'K-pop', 'Pokemon', 'Football', 'Oyun Kartları'];
const RARITIES = ['Hepsi', 'Common', 'Rare', 'Epic', 'Legendary'];

const KPOP_GROUPS = [
  { name: 'BTS',        emoji: '💜', desc: '7 üye' },
  { name: 'Stray Kids', emoji: '🐺', desc: '8 üye' },
  { name: 'ATEEZ',      emoji: '⚓', desc: '8 üye' },
  { name: 'TXT',        emoji: '🌙', desc: '5 üye' },
];

const GAME_GROUPS = [
  { name: 'Brawl Stars', emoji: '🎮', desc: '9 brawler' },
];

const TWO_TIER = {
  'K-pop':         { groups: KPOP_GROUPS, title: '🎤 K-pop Grupları',          hint: 'Bir gruba tıkla → üyelerin kartlarına ulaş.' },
  'Oyun Kartları': { groups: GAME_GROUPS, title: '🎮 Oyun Kartları Grupları', hint: 'Bir oyuna tıkla → karakter kartlarına ulaş.' },
};

const THREE_TIER = {};

export default function MarketplacePage() {
  return (
    <Suspense fallback={<main className="container"><div className="empty">Yükleniyor…</div></main>}>
      <Marketplace />
    </Suspense>
  );
}

function Marketplace() {
  const params = useSearchParams();
  const router = useRouter();

  const cat = params.get('cat') || 'Hepsi';
  const series = params.get('series') || null;
  const team = params.get('team') || null;
  const [rarity, setRarity] = useState('Hepsi');

  function setCat(nextCat) {
    const q = new URLSearchParams();
    if (nextCat !== 'Hepsi') q.set('cat', nextCat);
    router.push(`/marketplace${q.toString() ? '?' + q.toString() : ''}`);
  }

  const tier = TWO_TIER[cat];
  const showSeriesTiles = !!tier && !series;

  const subTier = series ? THREE_TIER[series] : null;
  const showTeamTiles = !!subTier && !team;

  const filtered = useMemo(() => {
    return cardsData.cards.filter((c) => {
      if (rarity === 'Hepsi' && c.primary === false) return false;
      if (cat !== 'Hepsi' && c.category !== cat) return false;
      if (series && c.series !== series) return false;
      if (team && c.team !== team) return false;
      if (rarity !== 'Hepsi' && c.rarity !== rarity) return false;
      return true;
    });
  }, [cat, series, team, rarity]);

  // Series tiles landing
  if (showSeriesTiles) {
    return (
      <main className="container">
        <h1 className="section-title">Marketplace</h1>
        <div className="filters">
          {CATS.map((c) => (
            <button
              key={c}
              className={`filter-btn ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <h2 className="section-title">{tier.title}</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 16 }}>{tier.hint}</p>
        <div className="grid">
          {tier.groups.map((g) => {
            const count = cardsData.cards.filter(
              (c) => c.category === cat && c.series === g.name && c.primary
            ).length;
            return (
              <Link
                key={g.name}
                href={`/marketplace?cat=${encodeURIComponent(cat)}&series=${encodeURIComponent(g.name)}`}
                className="card"
              >
                <div className="card-image">{g.emoji} {g.name}</div>
                <div className="card-body">
                  <div className="card-name">{g.name}</div>
                  <p className="card-meta">{g.desc} · {count} karakter mevcut</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  // Team tiles
  if (showTeamTiles) {
    return (
      <main className="container">
        <h1 className="section-title">Marketplace</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 12px' }}>
          <Link href={`/marketplace?cat=${encodeURIComponent(cat)}`} className="filter-btn">
            ← Serilere dön
          </Link>
          <strong style={{ color: 'var(--color-card)' }}>{series}</strong>
        </div>
        <h2 className="section-title">{subTier.title}</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 16 }}>{subTier.hint}</p>
        <div className="grid">
          {subTier.teams.map((t) => {
            const count = cardsData.cards.filter(
              (c) => c.series === series && c.team === t.name && c.primary
            ).length;
            const emptyHint = count === 0 ? ' (kartlar yakında)' : '';
            return (
              <Link
                key={t.name}
                href={`/marketplace?cat=${encodeURIComponent(cat)}&series=${encodeURIComponent(series)}&team=${encodeURIComponent(t.name)}`}
                className="card"
                style={count === 0 ? { opacity: 0.55 } : null}
              >
                <div className="card-image">{t.emoji} {t.name}</div>
                <div className="card-body">
                  <div className="card-name">{t.name}</div>
                  <p className="card-meta">{t.desc} · {count} oyuncu{emptyHint}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="section-title">Marketplace</h1>

      <div className="filters">
        {CATS.map((c) => (
          <button
            key={c}
            className={`filter-btn ${cat === c ? 'active' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {series && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 12px', flexWrap: 'wrap' }}>
          <Link href={`/marketplace?cat=${encodeURIComponent(cat)}`} className="filter-btn">
            ← Gruplara dön
          </Link>
          {team && (
            <Link
              href={`/marketplace?cat=${encodeURIComponent(cat)}&series=${encodeURIComponent(series)}`}
              className="filter-btn"
            >
              ← Takımlara dön
            </Link>
          )}
          <strong style={{ color: 'var(--color-card)' }}>
            {team ? `${team} oyuncuları` : `${series} üyeleri`}
          </strong>
        </div>
      )}

      <div className="filters">
        {RARITIES.map((r) => (
          <button
            key={r}
            className={`filter-btn ${rarity === r ? 'active' : ''}`}
            onClick={() => setRarity(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Bu filtreye uyan kart yok.</div>
      ) : (
        <div className="grid">
          {filtered.map((card) => (
            <CardTile key={card.code} card={card} price={cardsData.rarities[card.rarity].price} />
          ))}
        </div>
      )}
    </main>
  );
}
