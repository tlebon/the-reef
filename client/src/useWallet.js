/**
 * Wallet connection hook.
 * Supports MetaMask (or any injected provider) and generated wallets.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

export function useWallet() {
  // Restore wallet address on load — allows session persistence
  // For MetaMask: will need to re-sign on next registration/action
  const [wallet, setWallet] = useState(() => {
    try {
      const saved = localStorage.getItem('reef-wallet');
      if (!saved) return null;
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem('reef-wallet');
      return null;
    }
  });
  const savedAddress = wallet?.address || null;
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

  // Create a new wallet — signs auth message, returns private key once
  const createWallet = useCallback(async () => {
    if (wallet) return wallet; // prevent double-create
    const newWallet = ethers.Wallet.createRandom();
    const message = `Sign in to The Reef\nAddress: ${newWallet.address}\nTimestamp: ${Date.now()}`;
    const signature = await newWallet.signMessage(message);

    const walletData = {
      address: newWallet.address,
      privateKey: newWallet.privateKey, // shown to user once, not stored
      signature,
      message,
      type: 'generated',
    };
    // Only persist the address, NOT the private key or signature
    localStorage.setItem('reef-wallet', JSON.stringify({ address: newWallet.address, type: 'generated' }));
    setWallet(walletData);
    return walletData;
  }, [wallet]);

  const disconnect = useCallback(() => {
    localStorage.removeItem('reef-wallet');
    localStorage.removeItem('reef-agent-id');
    setWallet(null);
    setError(null);
  }, []);

  return {
    wallet,
    savedAddress,
    connecting,
    error,
    connectMetaMask,
    createWallet,
    disconnect,
  };
}
