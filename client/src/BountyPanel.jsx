import React, { useState } from 'react';

export default function BountyPanel({ bounties, myAgentId }) {
  const [collapsed, setCollapsed] = useState(false);

  const active = bounties.filter(b => !b.completed && !b.claimed && (!b.forAgentId || b.forAgentId === myAgentId));
  if (active.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setCollapsed(!collapsed)}>
        <h3 style={styles.title}>Quests ({active.length})</h3>
        <span style={styles.toggle}>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && active.map(b => (
        <div key={b.id} style={styles.bounty}>
          <div style={styles.bountyRow}>
            <span style={styles.bountyDesc}>{b.description}</span>
            <span style={styles.bountyReward}>{b.reward} USDC</span>
          </div>
          <div style={styles.bountyMeta}>
            <span style={styles.open}>Open</span>
            <span style={styles.poster}>by {b.poster}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
    borderBottom: '1px solid #1a2035',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  title: {
    fontSize: '0.9rem',
    color: '#00d4aa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  toggle: {
    color: '#5f6d7e',
    fontSize: '1rem',
    fontFamily: 'monospace',
  },
  bounty: {
    padding: '8px 0',
    borderBottom: '1px solid #0f1623',
  },
  bountyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  bountyDesc: {
    fontSize: '0.8rem',
    color: '#c8d6e5',
    lineHeight: 1.3,
  },
  bountyReward: {
    fontSize: '0.8rem',
    color: '#fdcb6e',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  bountyMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
    fontSize: '0.7rem',
  },
  open: {
    color: '#00d4aa',
  },
  poster: {
    color: '#3d4a5c',
  },
};
