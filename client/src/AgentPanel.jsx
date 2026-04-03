import React from 'react';

const ARCHETYPE_COLORS = {
  builder:  '#ff6b6b',
  merchant: '#fdcb6e',
  scout:    '#00b894',
  crafter:  '#a29bfe',
};

export default function AgentPanel({ agent, onClose }) {
  const avgRating = agent.reputation?.avgRating || 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.name}>{agent.name}</h3>
        <button onClick={onClose} style={styles.close}>x</button>
      </div>

      <div style={styles.badge}>
        <span style={{ ...styles.archetype, color: ARCHETYPE_COLORS[agent.archetype] }}>
          {agent.archetype}
        </span>
        <span style={styles.pos}>({agent.x}, {agent.y})</span>
      </div>

      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Energy</span>
          <span style={styles.statValue}>{agent.energy}/20</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Transactions</span>
          <span style={styles.statValue}>{agent.reputation?.transactions || 0}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Rating</span>
          <span style={styles.statValue}>{avgRating ? avgRating.toFixed(1) + '/5' : 'none'}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Tiles owned</span>
          <span style={styles.statValue}>{agent.tilesOwned || 0}</span>
        </div>
      </div>

      {agent.inventory && Object.keys(agent.inventory).length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Inventory</h4>
          {Object.entries(agent.inventory).map(([res, count]) => (
            <div key={res} style={styles.invItem}>
              <span>{res}</span>
              <span style={styles.muted}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {agent.services && agent.services.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Services</h4>
          {agent.services.map((s, i) => (
            <div key={i} style={styles.service}>
              <div style={styles.serviceName}>{s.name}</div>
              <div style={styles.serviceDesc}>{s.description}</div>
              <div style={styles.servicePrice}>{s.price} USDC</div>
            </div>
          ))}
        </div>
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
    marginBottom: '8px',
  },
  name: {
    fontSize: '1rem',
    color: '#e2e8f0',
  },
  close: {
    background: 'none',
    border: 'none',
    color: '#3d4a5c',
    cursor: 'pointer',
    fontSize: '1rem',
    fontFamily: 'monospace',
  },
  badge: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '12px',
  },
  archetype: {
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  pos: {
    fontSize: '0.8rem',
    color: '#3d4a5c',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#3d4a5c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '0.9rem',
    color: '#c8d6e5',
  },
  section: {
    marginTop: '12px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    color: '#00d4aa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '6px',
  },
  invItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    padding: '2px 0',
  },
  service: {
    padding: '6px 0',
    borderBottom: '1px solid #0f1623',
  },
  serviceName: {
    fontSize: '0.85rem',
    color: '#e2e8f0',
  },
  serviceDesc: {
    fontSize: '0.75rem',
    color: '#5f6d7e',
  },
  servicePrice: {
    fontSize: '0.75rem',
    color: '#fdcb6e',
    marginTop: '2px',
  },
  muted: {
    color: '#3d4a5c',
  },
};
