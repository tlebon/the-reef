import React, { useState } from 'react';

const ARCHETYPES = [
  { id: 'builder',  name: 'Builder',  color: '#ff6b6b', affinity: 'Coral',   desc: 'Efficient construction, structural bonuses' },
  { id: 'merchant', name: 'Merchant', color: '#fdcb6e', affinity: 'Shell',   desc: 'Better trade rates, price negotiation' },
  { id: 'scout',    name: 'Scout',    color: '#00b894', affinity: 'Kelp',    desc: 'Faster movement, exploration, bounties' },
  { id: 'crafter',  name: 'Crafter',  color: '#a29bfe', affinity: 'Crystal', desc: 'Combines resources into advanced materials' },
];

export default function JoinPanel({ onJoin, onCancel }) {
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState(null);

  const canJoin = name.trim().length > 0 && archetype;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Join The Reef</h3>
        <button onClick={onCancel} style={styles.close}>x</button>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Agent Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Choose a name..."
          style={styles.input}
          maxLength={20}
        />
        <span style={styles.hint}>{name.trim() ? `${name.trim()}.reef.eth` : 'becomes your ENS subname'}</span>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Archetype</label>
        <div style={styles.archetypes}>
          {ARCHETYPES.map(a => (
            <div
              key={a.id}
              style={{
                ...styles.archetypeCard,
                borderColor: archetype === a.id ? a.color : '#1a2035',
                background: archetype === a.id ? a.color + '15' : '#0f1623',
              }}
              onClick={() => setArchetype(a.id)}
            >
              <div style={{ ...styles.archetypeName, color: a.color }}>{a.name}</div>
              <div style={styles.archetypeAffinity}>{a.affinity} affinity</div>
              <div style={styles.archetypeDesc}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <button
        style={{ ...styles.joinBtn, opacity: canJoin ? 1 : 0.4 }}
        onClick={() => canJoin && onJoin(name.trim(), archetype)}
        disabled={!canJoin}
      >
        Spawn into The Reef
      </button>
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
    marginBottom: '16px',
  },
  title: {
    fontSize: '0.9rem',
    color: '#00d4aa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  close: {
    background: 'none',
    border: 'none',
    color: '#3d4a5c',
    cursor: 'pointer',
    fontSize: '1rem',
    fontFamily: 'monospace',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: '#5f6d7e',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    background: '#0f1623',
    border: '1px solid #1a2035',
    borderRadius: '4px',
    color: '#c8d6e5',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '0.7rem',
    color: '#3d4a5c',
    marginTop: '4px',
    display: 'block',
  },
  archetypes: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  archetypeCard: {
    padding: '10px',
    border: '1px solid #1a2035',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  archetypeName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '2px',
  },
  archetypeAffinity: {
    fontSize: '0.7rem',
    color: '#5f6d7e',
    marginBottom: '4px',
  },
  archetypeDesc: {
    fontSize: '0.7rem',
    color: '#3d4a5c',
    lineHeight: 1.3,
  },
  joinBtn: {
    width: '100%',
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    padding: '10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.85rem',
  },
};
