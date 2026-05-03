import Link from 'next/link';

export default function CardTile({ card, price }) {
  const rarityClass = `rarity-${card.rarity.toLowerCase()}`;
  const imageStyle = card.hasImage
    ? { backgroundImage: `url(${card.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : null;
  return (
    <Link href={`/card/${card.code}`} className="card">
      <div className="card-image" style={imageStyle}>
        {!card.hasImage && card.name}
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-name">{card.name}</span>
          <span className={`rarity-badge ${rarityClass}`}>{card.rarity}</span>
        </div>
        <p className="card-meta">{card.category} · {card.series}</p>
        <div className="price-row">
          <span>4 baskı mevcut</span>
          <strong>{price} XLM</strong>
        </div>
      </div>
    </Link>
  );
}
