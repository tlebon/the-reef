import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import WorldGrid from './WorldGrid.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import AgentPanel from './AgentPanel.jsx';

const SOCKET_URL = 'http://localhost:3001';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [worldState, setWorldState] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    const s = io(SOCKET_URL);

    s.on('connect', () => {
      addActivity('Connected to The Reef');
    });

    s.on('world:state', (state) => {
      setWorldState(state);
    });

    s.on('world:update', (state) => {
      setWorldState(state);
    });

    s.on('world:tick', ({ tick, hash, state }) => {
      setWorldState(state);
      addActivity(`Tick ${tick} — ${Object.keys(state.agents).length} agents, ${Object.keys(state.tiles).length} tiles — ${hash.slice(0, 12)}...`);
    });

    s.on('world:agent_joined', ({ agent }) => {
      addActivity(`${agent.name} (${agent.archetype}) joined The Reef at (${agent.x},${agent.y})`);
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  const addActivity = useCallback((msg) => {
    setActivities(prev => [...prev.slice(-99), { time: new Date(), msg }]);
  }, []);

  if (!worldState) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingText}>Connecting to The Reef...</div>
      </div>
    );
  }

  const agents = Object.values(worldState.agents || {});
  const tiles = worldState.tiles || {};

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>The Reef</h1>
        <div style={styles.stats}>
          <span>Tick: {worldState.tick}</span>
          <span>Agents: {agents.length}</span>
          <span>Tiles: {Object.keys(tiles).length}</span>
        </div>
      </header>

      <div style={styles.main}>
        <div style={styles.gridContainer}>
          <WorldGrid
            tiles={tiles}
            agents={agents}
            onSelectAgent={setSelectedAgent}
          />
        </div>

        <div style={styles.sidebar}>
          {selectedAgent ? (
            <AgentPanel
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          ) : (
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Agents</h3>
              {agents.length === 0 ? (
                <p style={styles.muted}>No agents yet. Waiting for connections...</p>
              ) : (
                agents.map(a => (
                  <div
                    key={a.id}
                    style={styles.agentItem}
                    onClick={() => setSelectedAgent(a)}
                  >
                    <span style={styles.archetypeBadge}>{a.archetype}</span>
                    <span>{a.name}</span>
                    <span style={styles.muted}>({a.x},{a.y})</span>
                  </div>
                ))
              )}
            </div>
          )}

          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#5f6d7e',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #1a2035',
    background: '#0d1220',
  },
  title: {
    fontSize: '1.4rem',
    color: '#00d4aa',
    fontWeight: 700,
  },
  stats: {
    display: 'flex',
    gap: '20px',
    fontSize: '0.85rem',
    color: '#5f6d7e',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  gridContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  sidebar: {
    width: '320px',
    borderLeft: '1px solid #1a2035',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panel: {
    padding: '16px',
    borderBottom: '1px solid #1a2035',
  },
  panelTitle: {
    fontSize: '0.9rem',
    color: '#00d4aa',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  agentItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '6px 0',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  archetypeBadge: {
    background: '#1a2035',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.75rem',
    color: '#00d4aa',
  },
  muted: {
    color: '#3d4a5c',
    fontSize: '0.8rem',
  },
};
