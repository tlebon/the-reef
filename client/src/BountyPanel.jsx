import React, { useState, useEffect, useRef } from 'react';

export default function BountyPanel({ bounties, agent }) {
  const [collapsed, setCollapsed] = useState(false);
  const [completedQuest, setCompletedQuest] = useState(null);
  const prevAgent = useRef(null);

  // Detect quest completion by watching agent state changes
  useEffect(() => {
    if (!agent || !prevAgent.current) {
      prevAgent.current = agent ? { ...agent } : null;
      return;
    }

    const prev = prevAgent.current;

    // Check if any seed quest was just completed
    if (prev.tilesOwned === 0 && agent.tilesOwned > 0) {
      setCompletedQuest({ description: 'Build your first structure on any tile', reward: 0.01 });
    } else if (Object.values(prev.inventory || {}).every(v => v === 0) &&
               Object.values(agent.inventory || {}).some(v => v > 0)) {
      setCompletedQuest({ description: 'Explore and discover a new tile', reward: 0.005 });
    }

    prevAgent.current = { ...agent, inventory: { ...agent.inventory } };
  }, [agent]);

  const active = bounties.filter(b => !b.completed && !b.claimed);
  if (active.length === 0 && !completedQuest) return null;

  return (
    <>
      {completedQuest && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Quest Complete!</h3>
            <p style={styles.modalDesc}>{completedQuest.description}</p>
            <p style={styles.modalReward}>+{completedQuest.reward} USDC</p>
            <button style={styles.modalBtn} onClick={() => setCompletedQuest(null)}>
              Continue
            </button>
          </div>
        </div>
      )}

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
              {b.claimed
                ? <span style={styles.claimed}>Claimed by {b.claimedBy}</span>
                : <span style={styles.open}>Open</span>
              }
              <span style={styles.poster}>by {b.poster}</span>
            </div>
          </div>
        ))}
      </div>
    </>
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
  claimed: {
    color: '#a29bfe',
  },
  poster: {
    color: '#3d4a5c',
  },
  modal: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#0d1220',
    border: '1px solid #00d4aa',
    borderRadius: '8px',
    padding: '32px',
    textAlign: 'center',
    maxWidth: '360px',
  },
  modalTitle: {
    color: '#00d4aa',
    fontSize: '1.2rem',
    marginBottom: '12px',
  },
  modalDesc: {
    color: '#c8d6e5',
    fontSize: '0.9rem',
    marginBottom: '8px',
  },
  modalReward: {
    color: '#fdcb6e',
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '20px',
  },
  modalBtn: {
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    padding: '10px 32px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.9rem',
  },
};
