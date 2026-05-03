import Link from 'next/link';
import cardsData from '@/data/cards.json';

const categories = [
  { key: 'K-pop',         title: '🎤 K-pop',         desc: 'BTS, Stray Kids, ATEEZ, TXT' },
  { key: 'Pokemon',       title: '⚡ Pokémon',       desc: 'Generation 1 → 4' },
  { key: 'Football',      title: '⚽ Futbol',         desc: 'Messi, Ronaldo, Neymar, Haaland, Salah' },
  { key: 'Oyun Kartları', title: '🎮 Oyun Kartları', desc: 'Brawl Stars' },
];

export default function Home() {
  const totalCards = cardsData.cards.length;
  const totalSupply = cardsData.cards.reduce(
    (acc, c) => acc + cardsData.rarities[c.rarity].supply,
    0
  );

  return (
    <main>
      <section className="hero">
        <h1>★ Stellar CardVerse</h1>
        <p>
          Sınırlı üretim, sahipliği blockchain ile doğrulanan dijital koleksiyon kartları.
          Stellar üzerinde alın, satın, takas edin.
        </p>
        <div className="cta-row">
          <Link href="/marketplace" className="cta">Marketplace'e Git</Link>
          <Link href="/collection" className="cta secondary">Koleksiyonum</Link>
        </div>
      </section>

      <div className="container">
        <h2 className="section-title">Kategoriler</h2>
        <div className="grid">
          {categories.map((cat) => (
            <Link key={cat.key} href={`/marketplace?cat=${encodeURIComponent(cat.key)}`} className="card">
              <div className="card-image">{cat.title}</div>
              <div className="card-body">
                <div className="card-name">{cat.title}</div>
                <p className="card-meta">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="section-title">Hızlı İstatistik</h2>
        <p>
          <strong>{totalCards}</strong> farklı karakter,{' '}
          <strong>{totalSupply.toLocaleString()}</strong> toplam basılmış birim. 4 nadirlik seviyesi:
          Common (10 XLM), Rare (50 XLM), Epic (150 XLM), Legendary (500 XLM).
        </p>
      </div>
    </main>
  );
}
