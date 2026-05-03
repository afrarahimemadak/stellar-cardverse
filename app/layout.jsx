import './globals.css';
import Link from 'next/link';
import { WalletProvider } from '@/components/WalletProvider';
import WalletButton from '@/components/WalletButton';

export const metadata = {
  title: 'Stellar CardVerse',
  description: 'Stellar blockchain üzerinde sınırlı üretim koleksiyon kartları.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <WalletProvider>
          <header className="nav">
            <Link href="/" className="nav-brand">★ Stellar CardVerse</Link>
            <nav className="nav-links">
              <Link href="/marketplace">Marketplace</Link>
              <Link href="/collection">Koleksiyonum</Link>
              <Link href="/admin">Admin</Link>
            </nav>
            <WalletButton />
          </header>
          {children}
          <footer className="footer">
            CardVerse — Stellar Testnet üzerinde çalışır. Test amaçlıdır.
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
