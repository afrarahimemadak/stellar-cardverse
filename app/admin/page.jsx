import cardsData from '@/data/cards.json';

export default function Admin() {
  const issuer = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
  const distributor = process.env.NEXT_PUBLIC_DISTRIBUTOR_PUBLIC;
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

  return (
    <main className="container">
      <h1 className="section-title">Admin / Kart Kataloğu</h1>

      <h3>Network</h3>
      <p><code>{network}</code></p>

      <h3>Issuer</h3>
      <p>{issuer
        ? <a href={`https://stellar.expert/explorer/testnet/account/${issuer}`} target="_blank" rel="noreferrer"><code>{issuer}</code></a>
        : <em>Henüz oluşturulmadı — `npm run setup` çalıştır.</em>}</p>

      <h3>Distributor (Marketplace)</h3>
      <p>{distributor
        ? <a href={`https://stellar.expert/explorer/testnet/account/${distributor}`} target="_blank" rel="noreferrer"><code>{distributor}</code></a>
        : <em>Henüz oluşturulmadı.</em>}</p>

      <h3>Tüm Kartlar ({cardsData.cards.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#fff' }}>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Code</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #9A9A9A' }}>İsim</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Kategori</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Seri</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Nadirlik</th>
            <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Supply</th>
            <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #9A9A9A' }}>Fiyat (XLM)</th>
          </tr>
        </thead>
        <tbody>
          {cardsData.cards.map((c) => {
            const r = cardsData.rarities[c.rarity];
            return (
              <tr key={c.code}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}><code>{c.code}</code></td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.category}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.series}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.rarity}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{r.supply}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{r.price}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
