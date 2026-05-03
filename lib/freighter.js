'use client';

import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
  signTransaction,
} from '@stellar/freighter-api';

export async function isFreighterReady() {
  const r = await isConnected();
  return !!(r && r.isConnected);
}

export async function connect() {
  const ready = await isFreighterReady();
  if (!ready) {
    throw new Error('Freighter not detected — install it from freighter.app');
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    await setAllowed();
  }

  const access = await requestAccess();
  if (access.error) throw new Error(access.error);

  const net = await getNetworkDetails();
  return { address: access.address, network: net.network, networkPassphrase: net.networkPassphrase };
}

export async function getCurrentAddress() {
  const r = await getAddress();
  if (r.error) return null;
  return r.address || null;
}

export async function signWithFreighter(xdr, networkPassphrase, address) {
  const r = await signTransaction(xdr, { networkPassphrase, address });
  if (r.error) throw new Error(r.error);
  return r.signedTxXdr;
}
