/**
 * Wallet connection hook.
 * Supports MetaMask (or any injected provider) and generated wallets.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

export function useWallet() {
  const [wallet, setWallet] = useState(() => {
    const saved = localStorage.getItem('reef-wallet');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Don't restore generated wallets — private key should not persist
    if (parsed.type === 'generated') return null;
    return parsed;
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Connect via MetaMask / injected provider
  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Install MetaMask or use "Create wallet".');
      return null;
    }

    setConnecting(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Sign a message to prove ownership
      const message = `Sign in to The Reef\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      const walletData = { address, signature, message, type: 'metamask' };
      // Only persist address and type — not signature (it has a timestamp)
      localStorage.setItem('reef-wallet', JSON.stringify({ address, type: 'metamask' }));
      setWallet(walletData);
      return walletData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Create a new wallet — returns private key once, does NOT persist it
  const createWallet = useCallback(() => {
    const newWallet = ethers.Wallet.createRandom();
    const walletData = {
      address: newWallet.address,
      privateKey: newWallet.privateKey, // shown to user once, not stored
      type: 'generated',
    };
    // Only persist the address, NOT the private key
    localStorage.setItem('reef-wallet', JSON.stringify({ address: newWallet.address, type: 'generated' }));
    setWallet(walletData);
    return walletData;
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('reef-wallet');
    localStorage.removeItem('reef-agent-id');
    setWallet(null);
    setError(null);
  }, []);

  return {
    wallet,
    connecting,
    error,
    connectMetaMask,
    createWallet,
    disconnect,
    isConnected: !!wallet,
  };
}
