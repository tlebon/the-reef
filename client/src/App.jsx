import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import WorldGrid from './WorldGrid.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import AgentPanel from './AgentPanel.jsx';
import TilePanel from './TilePanel.jsx';
import BountyPanel from './BountyPanel.jsx';
import JoinPanel from './JoinPanel.jsx';
import Welcome from './Welcome.jsx';
import ActionBar from './ActionBar.jsx';
import { useWallet } from './useWallet.js';
import KeyModal from './KeyModal.jsx';

const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `http://${window.location.hostname}:3001`;

export default function App() {
  const [socket, setSocket] = useState(null);
  const [worldState, setWorldState] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [myAgentId, setMyAgentId] = useState(() => localStorage.getItem('reef-agent-id'));
  const [showJoin, setShowJoin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('reef-agent-id'));
  const [latestBlock, setLatestBlock] = useState(null);
  const [joining, setJoining] = useState(false);
  const [completedQuest, setCompletedQuest] = useState(null);
  const { wallet, connecting, error: walletError, savedAddress, connectMetaMask, createWallet, disconnect } = useWallet();
  const [newWalletKey, setNewWalletKey] = useState(null);

  useEffect(() => {
    const s = io(SOCKET_URL);

    s.on('connect', () => {
      addActivity('Connected to The Reef');
    });

    s.on('world:state', (state) => {
      setWorldState(state);
      // Clear stale agent ID if agent no longer exists on server
      const savedId = localStorage.getItem('reef-agent-id');
      if (savedId && !state.agents[savedId]) {
        localStorage.removeItem('reef-agent-id');
        setMyAgentId(null);
        setShowWelcome(true);
      }
    });

    s.on('world:update', (state) => {
      setWorldState(state);
    });

    s.on('world:tick', ({ tick, block, hash, state }) => {
      setWorldState(state);
      setLatestBlock(block);
      addActivity(`Tick ${tick}${block ? ` (block #${block})` : ''} — ${Object.keys(state.agents).length} agents, ${Object.keys(state.tiles).length} tiles`);
    });

    s.on('world:agent_joined', ({ agent }) => {
      addActivity(`${agent.name} (${agent.archetype}) joined The Reef`);
    });

    s.on('agent:registered', ({ agent }) => {
      setMyAgentId(agent.id);
      localStorage.setItem('reef-agent-id', agent.id);
      setShowJoin(false);
      addActivity(`You joined as ${agent.name}!`);
    });

    s.on('quest:completed', (quests) => {
      for (const q of quests) {
        addActivity(`Quest complete: "${q.description}" — +${q.reward} USDC!`);
      }
      setCompletedQuest(quests[0]);
    });

    s.on('agent:result', ({ command, result }) => {
      if (result.error) {
        addActivity(`Error: ${result.error}`);
      } else if (result.message) {
        addActivity(result.message);
      }
    });

    s.on('agent:error', ({ error }) => {
      addActivity(`Error: ${error}`);
      setJoining(false);
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  const addActivity = useCallback((msg) => {
    setActivities(prev => [...prev.slice(-99), { time: new Date(), msg }]);
  }, []);

  const handleJoin = (name, archetype) => {
    if (!socket) return;
    setJoining(true);
    addActivity(`Joining as ${name} (${archetype})...`);
    socket.emit('agent:register', {
      name,
      archetype,
      walletAddress: wallet?.address || null,
      signature: wallet?.signature || null,
      message: wallet?.message || null,
    });
  };

  const handleCommand = (command) => {
    if (!socket || !myAgentId) return;
    addActivity(`> ${command}`);
    socket.emit('agent:command', { agentId: myAgentId, command });
  };

  if (!worldState) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingText}>Connecting to The Reef...</div>
      </div>
    );
  }

  if (showWelcome && !myAgentId) {
    return <Welcome
      onEnter={() => { setShowWelcome(false); setShowJoin(true); }}
      wallet={wallet}
      onConnectMetaMask={async () => {
        const w = await connectMetaMask();
        if (w) addActivity(`Wallet connected: ${w.address.slice(0, 10)}...`);
      }}
      onCreateWallet={async () => {
        try {
          const w = await createWallet();
          addActivity(`New wallet created: ${w.address.slice(0, 10)}...`);
          if (w.privateKey) {
            setNewWalletKey(w);
          }
        } catch (err) {
          addActivity(`Error creating wallet: ${err.message}`);
        }
      }}
      connecting={connecting}
      walletError={walletError}
      savedAddress={savedAddress}
    />;
  }

  if (newWalletKey) {
    return <KeyModal
      privateKey={newWalletKey.privateKey}
      address={newWalletKey.address}
      onConfirm={() => { setNewWalletKey(null); setShowJoin(true); }}
    />;
  }

  const agents = Object.values(worldState.agents || {});
  const tiles = worldState.tiles || {};
  const bounties = worldState.bounties || [];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>The Reef</h1>
        <div style={styles.stats}>
          <span>Tick: {worldState.tick}</span>
          {latestBlock && <span>Block: #{latestBlock}</span>}
          <span>Agents: {agents.length}</span>
          <span>Tiles: {Object.keys(tiles).length}</span>
        </div>
        {!myAgentId && !showJoin && (
          <button style={styles.joinBtn} onClick={() => setShowJoin(true)}>Join The Reef</button>
        )}
        {myAgentId && (
          <span style={styles.myAgent}>
            {worldState.agents[myAgentId]?.name || myAgentId}
            {wallet && <span style={styles.walletBadge}>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>}
            <button style={styles.logoutBtn} onClick={() => { disconnect(); setMyAgentId(null); setShowWelcome(true); setShowJoin(false); }}>logout</button>
          </span>
        )}
      </header>

      {completedQuest && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Quest Complete!</h3>
            <p style={styles.modalDesc}>{completedQuest.description}</p>
            <p style={styles.modalReward}>+{completedQuest.reward} USDC</p>
            <button style={styles.modalBtn} onClick={() => setCompletedQuest(null)}>Continue</button>
          </div>
        </div>
      )}

      <div style={styles.mainWrapper}>
      <div style={styles.main}>
        <div style={styles.gridContainer}>
          <WorldGrid
            tiles={tiles}
            agents={agents}
            onSelectAgent={(a) => { setSelectedAgent(a); setSelectedTile(null); }}
            onSelectTile={(t) => { setSelectedTile(t); setSelectedAgent(null); }}
            myAgentId={myAgentId}
          />
        </div>

        <div style={styles.sidebar}>
          {showJoin && !myAgentId && (
            <JoinPanel onJoin={handleJoin} onCancel={() => setShowJoin(false)} />
          )}

          {selectedAgent && (
            <AgentPanel
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          )}

          {selectedTile && !selectedAgent && (
            <TilePanel
              tile={selectedTile}
              agents={agents}
              myAgentId={myAgentId}
              onCommand={handleCommand}
              onClose={() => setSelectedTile(null)}
            />
          )}

          {!selectedAgent && !selectedTile && !showJoin && (
            <>
              <BountyPanel bounties={bounties} myAgentId={myAgentId} onCommand={handleCommand} />
              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>Agents</h3>
                {agents.length === 0 ? (
                  <p style={styles.muted}>No agents yet.</p>
                ) : (
                  agents.map(a => (
                    <div
                      key={a.id}
                      style={styles.agentItem}
                      onClick={() => setSelectedAgent(a)}
                    >
                      <span style={{
                        ...styles.archetypeBadge,
                        color: { builder: '#ff6b6b', merchant: '#fdcb6e', scout: '#00b894', crafter: '#a29bfe' }[a.archetype] || '#00d4aa',
                      }}>{a.archetype}</span>
                      <span>{a.name}</span>
                      {a.id === myAgentId && <span style={styles.youBadge}>you</span>}
                      <span style={styles.muted}>({a.x},{a.y})</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <ActivityFeed activities={activities} />
        </div>
      </div>
      </div>

      {myAgentId && worldState.agents[myAgentId] && (
        <ActionBar
          agent={worldState.agents[myAgentId]}
          currentTile={tiles[`${worldState.agents[myAgentId].x},${worldState.agents[myAgentId].y}`]}
          messages={worldState.messages}
          agents={agents}
          onCommand={handleCommand}
        />
      )}
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
  mainWrapper: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
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
    width: '340px',
    borderLeft: '1px solid #1a2035',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    zIndex: 20,
    background: '#0a0e17',
    position: 'relative',
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
  youBadge: {
    background: '#00d4aa',
    color: '#0a0e17',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '0.65rem',
    fontWeight: 700,
  },
  joinBtn: {
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.85rem',
  },
  myAgent: {
    color: '#00d4aa',
    fontSize: '0.85rem',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  walletBadge: {
    color: '#5f6d7e',
    fontSize: '0.7rem',
    fontFamily: 'monospace',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#3d4a5c',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.7rem',
    padding: '2px 4px',
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
