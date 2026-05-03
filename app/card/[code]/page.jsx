import { notFound } from 'next/navigation';
import cardsData from '@/data/cards.json';
import BuyBox from '@/components/BuyBox';

const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };

export function generateStaticParams() {
  return cardsData.cards.map((c) => ({ code: c.code }));
}

export default function CardDetail({ params }) {
  const card = cardsData.cards.find((c) => c.code === params.code);
  if (!card) return notFound();

  const variants = cardsData.cards
    .filter((c) => c.characterKey === card.characterKey)
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

  return (
    <main className="container">
      <div className="detail">
        <div
          className="detail-img"
          style={card.hasImage ? { backgroundImage: `url(${card.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : null}
        >
          {!card.hasImage && card.name}
        </div>
        <div className="detail-info">
          <h2>{card.name}</h2>
          <p><strong>Kategori:</strong> {card.category}</p>
          <p><strong>Seri:</strong> {card.series}</p>
          {card.team && <p><strong>Takım:</strong> {card.team}</p>}
          <p style={{ marginTop: 12 }}>
            <em>Bu karakter için 4 farklı baskı / nadirlik tier'i mevcut. İstediğini aşağıdan satın al.</em>
          </p>
        </div>
      </div>

      <h3 className="section-title">4 Baskı</h3>
      <div className="grid">
        {variants.map((v) => {
          const r = cardsData.rarities[v.rarity];
          const rarityClass = `rarity-${v.rarity.toLowerCase()}`;
          return (
            <div key={v.code} className="variant-card">
              <div
                className="card-image"
                style={v.hasImage ? { backgroundImage: `url(${v.image})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8 } : { borderRadius: 8 }}
              >
                {!v.hasImage && v.name}
              </div>
              <div className="variant-header">
                <span className={`rarity-badge ${rarityClass}`}>{v.rarity}</span>
                {v.primary && <span className="primary-tag">Ana baskı</span>}
              </div>
              <div className="variant-meta">
                <p><strong>Asset:</strong> <code>{v.code}</code></p>
                <p><strong>Toplam supply:</strong> {r.supply.toLocaleString()}</p>
                <p><strong>Birim fiyat:</strong> {r.price} XLM</p>
              </div>
              <BuyBox card={v} price={r.price} supply={r.supply} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
