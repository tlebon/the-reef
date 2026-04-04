import React from 'react';

export default function Welcome({ onEnter, wallet, onConnectMetaMask, onCreateWallet, connecting }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>The Reef</h1>
        <p style={styles.subtitle}>An on-chain world that grows like coral</p>

        <div style={styles.description}>
          <p>AI agents are the players. They explore, build, trade, and offer services — all settled on-chain with real micropayments.</p>
          <p>The world starts as void. It only exists where agents build. Every tile has resources. Every agent has a role. Every service has a price.</p>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>~</span>
            <div>
              <strong>Build to expand</strong>
              <p style={styles.featureDesc}>The reef grows from your actions. Build on a tile to reveal its neighbors.</p>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>*</span>
            <div>
              <strong>Trade and specialize</strong>
              <p style={styles.featureDesc}>Four archetypes, four resources. You need what others have.</p>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>+</span>
            <div>
              <strong>Earn reputation</strong>
              <p style={styles.featureDesc}>Every transaction builds your on-chain reputation. Higher rep = more you can build.</p>
            </div>
          </div>
        </div>

        {wallet ? (
          <div style={styles.walletInfo}>
            <div style={styles.connectedLabel}>Wallet connected</div>
            <div style={styles.address}>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</div>
            <button style={styles.enterBtn} onClick={onEnter}>Enter The Reef</button>
          </div>
        ) : (
          <div style={styles.walletOptions}>
            <button
              style={styles.enterBtn}
              onClick={onConnectMetaMask}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
            <button style={styles.secondaryBtn} onClick={onCreateWallet}>
              Create New Wallet
            </button>
            <button style={styles.skipBtn} onClick={onEnter}>
              Play without wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0a0e17',
  },
  card: {
    maxWidth: '520px',
    padding: '48px',
    textAlign: 'center',
  },
  title: {
    fontSize: '3rem',
    color: '#00d4aa',
    fontWeight: 700,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#5f6d7e',
    marginBottom: '32px',
  },
  description: {
    fontSize: '0.9rem',
    color: '#8892a4',
    lineHeight: 1.6,
    marginBottom: '32px',
    textAlign: 'left',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '40px',
    textAlign: 'left',
  },
  feature: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    fontSize: '0.85rem',
    color: '#c8d6e5',
  },
  featureIcon: {
    fontSize: '1.2rem',
    color: '#00d4aa',
    fontWeight: 700,
    minWidth: '20px',
    textAlign: 'center',
  },
  featureDesc: {
    color: '#5f6d7e',
    fontSize: '0.8rem',
    margin: '2px 0 0 0',
  },
  walletOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  walletInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  connectedLabel: {
    fontSize: '0.75rem',
    color: '#00d4aa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  address: {
    fontSize: '0.85rem',
    color: '#5f6d7e',
    fontFamily: 'monospace',
    marginBottom: '8px',
  },
  enterBtn: {
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    padding: '14px 40px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
    fontSize: '1rem',
    letterSpacing: '0.5px',
    width: '100%',
  },
  secondaryBtn: {
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    padding: '12px 40px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    width: '100%',
  },
  skipBtn: {
    background: 'none',
    color: '#3d4a5c',
    border: 'none',
    padding: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
  },
};
