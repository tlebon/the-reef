import React, { useState } from 'react';

export default function BountyPanel({ bounties, myAgentId, onCommand }) {
  const [collapsed, setCollapsed] = useState(false);

  const myQuests = bounties.filter(b => !b.completed && b.forAgentId === myAgentId);
  const publicQuests = bounties.filter(b => !b.completed && !b.forAgentId && !b.claimed);
  const total = myQuests.length + publicQuests.length;

  if (total === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setCollapsed(!collapsed)}>
        <h3 style={styles.title}>Quests ({total})</h3>
        <span style={styles.toggle}>{collapsed ? '+' : '-'}</span>
      </div>

      {!collapsed && (
        <>
          {myQuests.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Your quests</div>
              {myQuests.map(b => (
                <div key={b.id} style={styles.bounty}>
                  <div style={styles.bountyRow}>
                    <span style={styles.bountyDesc}>{b.description}</span>
                    <span style={styles.bountyReward}>{b.reward} USDC</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {publicQuests.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Public quests</div>
              {publicQuests.map(b => (
                <div key={b.id} style={styles.bounty}>
                  <div style={styles.bountyRow}>
                    <span style={styles.bountyDesc}>{b.description}</span>
                    <span style={styles.bountyReward}>{b.reward} USDC</span>
                  </div>
                  <div style={styles.bountyMeta}>
                    <button
                      style={styles.claimBtn}
                      onClick={() => onCommand(`CLAIM_BOUNTY ${b.id}`)}
                    >Claim</button>
                    <span style={styles.poster}>by {b.poster}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
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
  sectionLabel: {
    fontSize: '0.7rem',
    color: '#3d4a5c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '10px',
    marginBottom: '4px',
  },
  bounty: {
    padding: '6px 0',
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
    alignItems: 'center',
    marginTop: '4px',
    fontSize: '0.7rem',
  },
  claimBtn: {
    background: '#1a2035',
    color: '#00d4aa',
    border: '1px solid #00d4aa40',
    borderRadius: '3px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.7rem',
  },
  poster: {
    color: '#3d4a5c',
  },
};
