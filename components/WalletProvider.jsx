'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { connect, getCurrentAddress } from '@/lib/freighter';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [network, setNetwork] = useState(null);
  const [networkPassphrase, setNetworkPassphrase] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCurrentAddress().then((a) => a && setAddress(a)).catch(() => {});
  }, []);

  const doConnect = useCallback(async () => {
    setError(null);
    try {
      const r = await connect();
      setAddress(r.address);
      setNetwork(r.network);
      setNetworkPassphrase(r.networkPassphrase);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setNetworkPassphrase(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, network, networkPassphrase, error, connect: doConnect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside <WalletProvider>');
  return ctx;
}
