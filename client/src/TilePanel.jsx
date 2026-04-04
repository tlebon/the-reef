import React from 'react';

const RESOURCE_COLORS = {
  coral:   '#ff6b6b',
  crystal: '#a29bfe',
  kelp:    '#00b894',
  shell:   '#fdcb6e',
};

export default function TilePanel({ tile, agents, myAgentId, onCommand, onClose }) {
  const owner = agents.find(a => a.id === tile.owner);
  const tileAgents = agents.filter(a => a.x === tile.x && a.y === tile.y);
  const tileServices = tile.services || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Tile ({tile.x}, {tile.y})</h3>
        <button onClick={onClose} style={styles.close}>x</button>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Resource</span>
        <span style={{ color: RESOURCE_COLORS[tile.resource], fontWeight: 600 }}>
          {tile.resource}
        </span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Status</span>
        <span style={styles.value}>{tile.built ? 'Built' : 'Empty'}</span>
      </div>

      {owner && (
        <div style={styles.row}>
          <span style={styles.label}>Owner</span>
          <span style={styles.value}>{owner.name}</span>
        </div>
      )}

      {tile.built && (
        <div style={styles.row}>
          <span style={styles.label}>Symbol</span>
          <span style={{ ...styles.value, fontSize: '1.2rem' }}>{tile.symbol}</span>
        </div>
      )}

      {tileAgents.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Agents here</h4>
          {tileAgents.map(a => (
            <div key={a.id} style={styles.agentRow}>
              <span style={styles.archetypeBadge}>{a.archetype}</span>
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {tileServices.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Services</h4>
          {tileServices.map((s, i) => (
            <div key={i} style={styles.service}>
              <div style={styles.serviceName}>{s.name}</div>
              <div style={styles.serviceDesc}>{s.description}</div>
              <div style={styles.servicePrice}>{s.price} USDC</div>
            </div>
          ))}
        </div>
      )}

      {!tile.built && (
        <div style={styles.hint}>
          <p>This tile has {tile.resource} resources. Stand here and build to claim it.</p>
          <p style={{ marginTop: '6px' }}>Mint cost: {(() => {
            const costs = {
              coral:   { coral: 3, crystal: 2, kelp: 0, shell: 1 },
              crystal: { coral: 1, crystal: 3, kelp: 2, shell: 0 },
              kelp:    { coral: 0, crystal: 1, kelp: 3, shell: 2 },
              shell:   { coral: 2, crystal: 0, kelp: 1, shell: 3 },
            };
            const c = costs[tile.resource] || {};
            return Object.entries(c).filter(([,v]) => v > 0).map(([r,v]) => `${v} ${r}`).join(', ');
          })()}</p>
        </div>
      )}

      {tile.built && tile.owner === myAgentId && onCommand && (
        <div style={styles.ownerActions}>
          <h4 style={styles.sectionTitle}>Your tile</h4>
          <button style={styles.actionBtn} onClick={() => {
            const name = prompt('Service name:');
            if (!name) return;
            const price = prompt('Price (USDC):') || '0.01';
            const desc = prompt('Description:') || 'A service';
            onCommand(`REGISTER_SERVICE ${name} ${price} ${desc}`);
          }}>Register service (2e)</button>
          <button style={styles.actionBtn} onClick={() => {
            const msg = prompt('Say something:');
            if (msg) onCommand(`SAY ${msg}`);
          }}>Say</button>
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
    marginBottom: '12px',
  },
  title: {
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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '0.85rem',
  },
  label: {
    color: '#5f6d7e',
  },
  value: {
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
  agentRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: '0.85rem',
    color: '#c8d6e5',
  },
  archetypeBadge: {
    background: '#1a2035',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.7rem',
    color: '#00d4aa',
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
  hint: {
    marginTop: '12px',
    fontSize: '0.8rem',
    color: '#3d4a5c',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  ownerActions: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #1a2035',
  },
  actionBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    marginTop: '6px',
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    textAlign: 'left',
  },
};
