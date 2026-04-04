/**
 * Wallet connection hook.
 * Supports MetaMask (or any injected provider) and server-generated wallets.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

export function useWallet() {
  const [wallet, setWallet] = useState(() => {
    const saved = localStorage.getItem('reef-wallet');
    return saved ? JSON.parse(saved) : null;
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
      localStorage.setItem('reef-wallet', JSON.stringify(walletData));
      setWallet(walletData);
      return walletData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Create a new wallet (server-generated or client-generated)
  const createWallet = useCallback(() => {
    const newWallet = ethers.Wallet.createRandom();
    const walletData = {
      address: newWallet.address,
      privateKey: newWallet.privateKey,
      type: 'generated',
    };
    localStorage.setItem('reef-wallet', JSON.stringify(walletData));
    setWallet(walletData);
    return walletData;
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('reef-wallet');
    localStorage.removeItem('reef-agent-id');
    setWallet(null);
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
