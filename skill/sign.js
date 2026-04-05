#!/usr/bin/env node
/**
 * Sign a Reef auth message with a private key.
 * Outputs JSON with signature, message, and wallet address.
 *
 * Usage: node sign.js <private_key>
 *    or: REEF_PRIVATE_KEY=0x... node sign.js
 */

import { ethers } from 'ethers';

const privateKey = process.argv[2] || process.env.REEF_PRIVATE_KEY;
if (!privateKey) {
  console.error('Usage: node sign.js <private_key>');
  console.error('   or: REEF_PRIVATE_KEY=0x... node sign.js');
  process.exit(1);
}

const wallet = new ethers.Wallet(privateKey);
const message = `Sign in to The Reef\nWallet: ${wallet.address}\nTimestamp: ${Date.now()}`;
const signature = await wallet.signMessage(message);

console.log(JSON.stringify({
  address: wallet.address,
  signature,
  message,
  encodedMessage: encodeURIComponent(message),
}));
