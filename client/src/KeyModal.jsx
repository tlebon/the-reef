import React, { useState } from 'react';

export default function KeyModal({ privateKey, address, onConfirm }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(privateKey).then(() => setCopied(true));
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Save Your Private Key</h3>
        <p style={styles.warning}>This key will NOT be shown again. Save it somewhere safe.</p>

        <div style={styles.field}>
          <label style={styles.label}>Address</label>
          <div style={styles.value}>{address}</div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Private Key</label>
          <div style={styles.keyBox}>
            <code style={styles.key}>{privateKey}</code>
            <button style={styles.copyBtn} onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <label style={styles.checkbox}>
          <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
          <span>I have saved my private key</span>
        </label>

        <button
          style={{ ...styles.confirmBtn, opacity: saved ? 1 : 0.4 }}
          disabled={!saved}
          onClick={onConfirm}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: '#0d1220',
    border: '1px solid #ff6b6b',
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '480px',
    width: '90%',
  },
  title: {
    color: '#ff6b6b',
    fontSize: '1.2rem',
    marginBottom: '8px',
  },
  warning: {
    color: '#fdcb6e',
    fontSize: '0.85rem',
    marginBottom: '20px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    color: '#5f6d7e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  value: {
    fontSize: '0.8rem',
    color: '#c8d6e5',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  keyBox: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  key: {
    flex: 1,
    fontSize: '0.75rem',
    color: '#ff6b6b',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    background: '#1a2035',
    padding: '8px',
    borderRadius: '4px',
  },
  copyBtn: {
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    borderRadius: '4px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    flexShrink: 0,
  },
  checkbox: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: '#c8d6e5',
    marginBottom: '20px',
    cursor: 'pointer',
  },
  confirmBtn: {
    width: '100%',
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    padding: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.9rem',
  },
};
