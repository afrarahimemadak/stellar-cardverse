'use client';

import { useWallet } from './WalletProvider';

function shortenAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

export default function WalletButton() {
  const { address, connect, disconnect, error } = useWallet();

  if (address) {
    return (
      <button className="wallet-btn connected" onClick={disconnect} title={address}>
        {shortenAddress(address)}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button className="wallet-btn" onClick={connect}>
        Cüzdanı Bağla
      </button>
      {error && <span className="wallet-error">{error}</span>}
    </div>
  );
}
