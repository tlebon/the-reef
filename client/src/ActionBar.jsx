import React, { useState, useEffect } from 'react';
import InputModal from './InputModal';
import { MODAL_CONFIGS, sanitizeName } from './modalConfigs';

export default function ActionBar({ agent, currentTile, messages, agents, onCommand }) {
  const [showBuild, setShowBuild] = useState(false);
  const [buildSymbol, setBuildSymbol] = useState('#');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const handleKey = (e) => {
      // Don't capture keys when typing in an input
      if (e.target.tagName === 'INPUT') return;

      const keyMap = {
        ArrowUp: 'MOVE N', ArrowDown: 'MOVE S', ArrowLeft: 'MOVE W', ArrowRight: 'MOVE E',
        w: 'MOVE N', s: 'MOVE S', a: 'MOVE W', d: 'MOVE E',
        W: 'MOVE N', S: 'MOVE S', A: 'MOVE W', D: 'MOVE E',
        b: 'BUILD_TOGGLE', B: 'BUILD_TOGGLE',
      };

      const action = keyMap[e.key];
      if (!action) return;

      e.preventDefault();
      if (action === 'BUILD_TOGGLE') {
        setShowBuild(prev => !prev);
      } else {
        onCommand(action);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCommand]);

  const closeModal = () => setModal(null);

  if (!agent) return null;

  const renderModal = () => {
    if (!modal) return null;

    // Resolve config — static object or function (exchange/combine need ownerName)
    const rawCfg = MODAL_CONFIGS[modal.type];
    const config = typeof rawCfg === 'function' ? rawCfg(modal.ownerName) : rawCfg;
    if (!config) return null;

    return (
      <InputModal
        title={config.title}
        fields={config.fields}
        sanitize={sanitizeName}
        onCancel={closeModal}
        onConfirm={(vals) => {
          closeModal();
          const cmd = config.toCommand(vals);
          if (cmd) onCommand(cmd);
        }}
      />
    );
  };

  return (
    <div style={styles.container}>
      {renderModal()}
      <div style={styles.status}>
        <span style={styles.name}>{agent.name}</span>
        <span style={styles.energy}>Energy: {agent.energy}{agent.energy > 20 ? ' (boosted)' : '/20'}</span>
        <span style={styles.pos}>({agent.x},{agent.y})</span>
      </div>

      <div style={styles.actions}>
        <div style={styles.moveGrid}>
          <div style={styles.moveRow}>
            <div style={styles.moveSpacer} />
            <button style={styles.moveBtn} onClick={() => onCommand('MOVE N')}>N</button>
            <div style={styles.moveSpacer} />
          </div>
          <div style={styles.moveRow}>
            <button style={styles.moveBtn} onClick={() => onCommand('MOVE W')}>W</button>
            <button style={{ ...styles.moveBtn, background: '#1a2035', color: '#3d4a5c' }} disabled>.</button>
            <button style={styles.moveBtn} onClick={() => onCommand('MOVE E')}>E</button>
          </div>
          <div style={styles.moveRow}>
            <div style={styles.moveSpacer} />
            <button style={styles.moveBtn} onClick={() => onCommand('MOVE S')}>S</button>
            <div style={styles.moveSpacer} />
          </div>
        </div>

        <div style={styles.actionBtns}>
          {currentTile && currentTile.owner === agent.id ? (
            // On your own tile — show services + owner actions
            <>
              <div style={styles.tileLabel}>Your tile ({currentTile.resource})</div>
              {currentTile.services && currentTile.services.length > 0 && (
                <div style={styles.serviceList}>
                  {currentTile.services.filter(s => s.agentId === agent.id).map((s) => (
                    <div key={s.name} style={styles.serviceItem}>
                      <span style={styles.serviceName}>{s.name}</span>
                      <span style={styles.servicePrice}>{s.price} USDC</span>
                      <button style={styles.smallBtn} onClick={() => onCommand(`REMOVE_SERVICE ${s.name}`)}>x</button>
                    </div>
                  ))}
                </div>
              )}
              <button style={styles.actionBtn} onClick={() => setModal({ type: 'register-service' })}>+ Add service</button>
              <button style={styles.actionBtn} onClick={() => setModal({ type: 'say' })}>Say</button>
              <button style={styles.actionBtn} onClick={() => setModal({ type: 'post-bounty' })}>Post bounty</button>
              <button style={styles.actionBtn} onClick={() => onCommand('SCAVENGE')}>Scavenge (2e)</button>
            </>
          ) : currentTile && currentTile.built ? (
            // On someone else's tile — show their services
            <>
              <div style={styles.tileLabel}>{currentTile.resource} tile (owned)</div>
              {currentTile.services && currentTile.services.length > 0 && (
                <div style={styles.serviceList}>
                  {currentTile.services.map((s, i) => (
                    <button key={i} style={styles.actionBtn} onClick={() => {
                      const ownerName = agents.find(a => a.id === s.agentId)?.name;
                      if (!ownerName) return;
                      if (s.name === 'exchange') {
                        setModal({ type: 'exchange', ownerName });
                      } else if (s.name === 'combine') {
                        setModal({ type: 'combine', ownerName });
                      } else {
                        onCommand(`INVOKE_SERVICE ${ownerName} ${s.name}`);
                      }
                    }}>
                      {s.name} ({s.price} USDC) — {s.description}
                    </button>
                  ))}
                </div>
              )}
              <button style={styles.actionBtn} onClick={() => onCommand('SCAVENGE')}>Scavenge (2e)</button>
              <button style={styles.actionBtn} onClick={() => setModal({ type: 'say' })}>Say</button>
            </>
          ) : currentTile && !currentTile.built ? (
            // On an unbuilt tile
            showBuild ? (
              <div style={styles.buildRow}>
                <input
                  style={styles.buildInput}
                  value={buildSymbol}
                  onChange={e => setBuildSymbol(e.target.value.slice(0, 1))}
                  maxLength={1}
                />
                <button style={styles.actionBtn} onClick={() => { onCommand(`BUILD ${buildSymbol}`); setShowBuild(false); }}>
                  {agent.tilesOwned === 0 ? 'Claim (free)' : 'Mint'}
                </button>
                <button style={styles.cancelBtn} onClick={() => setShowBuild(false)}>x</button>
              </div>
            ) : (
              <>
                <div style={styles.tileLabel}>{currentTile.resource} tile (unclaimed)</div>
                <button style={styles.actionBtn} onClick={() => setShowBuild(true)}>
                  {agent.tilesOwned === 0 ? 'Claim home tile (free)' : 'Mint tile (costs resources)'}
                </button>
                <button style={styles.actionBtn} onClick={() => onCommand('SCAVENGE')}>Scavenge (2e)</button>
              </>
            )
          ) : null}

          {/* Rest — always visible */}
          {(() => {
            const hasEnough = agent.inventory && Object.entries(agent.inventory).some(([,v]) => v >= 3);
            return (
              <select
                style={{ ...styles.restSelect, opacity: hasEnough ? 1 : 0.4 }}
                value=""
                disabled={!hasEnough}
                onChange={e => { if (e.target.value) onCommand(`REST ${e.target.value}`); e.target.value = ''; }}
              >
                <option value="">{hasEnough ? 'Rest (3 resource → +8e)' : 'Rest (need 3 of any resource)'}</option>
                {agent.inventory && Object.entries(agent.inventory).filter(([,v]) => v >= 3).map(([res]) => (
                  <option key={res} value={res}>{res} ({agent.inventory[res]})</option>
                ))}
              </select>
            );
          })()}
        </div>
      </div>

      <div style={styles.bottomRow}>
        {agent.inventory && Object.keys(agent.inventory).some(k => agent.inventory[k] > 0) && (
          <div style={styles.inventory}>
            {Object.entries(agent.inventory).filter(([,v]) => v > 0).map(([res, count]) => (
              <span key={res} style={styles.invItem}>
                <span style={styles.invRes}>{res}</span>
                <span style={styles.invCount}>{count}</span>
              </span>
            ))}
          </div>
        )}
        {agent.loot && agent.loot.length > 0 && (
          <div style={styles.inventory}>
            {agent.loot.map(item => (
              <span key={item.id} style={{ ...styles.invItem, color: item.color }}>
                {item.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {messages && messages.length > 0 && (
        <div style={styles.chatLog}>
          {messages.slice(-3).map((m, i) => (
            <div key={i} style={styles.chatMsg}>
              <span style={styles.chatFrom}>{m.from}:</span> {m.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: '340px',
    padding: '12px 16px',
    borderTop: '1px solid #1a2035',
    background: '#0d1220',
    zIndex: 10,
  },
  status: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '0.8rem',
  },
  name: {
    color: '#00d4aa',
    fontWeight: 600,
  },
  energy: {
    color: '#fdcb6e',
  },
  pos: {
    color: '#3d4a5c',
  },
  actions: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  moveGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  moveRow: {
    display: 'flex',
    gap: '2px',
    justifyContent: 'center',
  },
  moveSpacer: {
    width: '32px',
    height: '28px',
  },
  moveBtn: {
    width: '32px',
    height: '28px',
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  actionBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  tileLabel: {
    fontSize: '0.7rem',
    color: '#5f6d7e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },
  serviceList: {
    marginBottom: '4px',
  },
  serviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 0',
    fontSize: '0.75rem',
  },
  serviceName: {
    color: '#c8d6e5',
    flex: 1,
  },
  servicePrice: {
    color: '#fdcb6e',
  },
  restSelect: {
    padding: '6px 8px',
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginTop: '4px',
  },
  smallBtn: {
    background: 'none',
    border: '1px solid #2d3748',
    color: '#5f6d7e',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    padding: '1px 4px',
  },
  actionBtn: {
    padding: '6px 12px',
    background: '#1a2035',
    color: '#c8d6e5',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
  },
  buildRow: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  buildInput: {
    width: '28px',
    padding: '4px',
    background: '#0f1623',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    color: '#c8d6e5',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  cancelBtn: {
    padding: '4px 8px',
    background: 'none',
    color: '#3d4a5c',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  bottomRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  inventory: {
    display: 'flex',
    gap: '10px',
    fontSize: '0.75rem',
  },
  invItem: {
    display: 'flex',
    gap: '4px',
  },
  invRes: {
    color: '#5f6d7e',
  },
  invCount: {
    color: '#c8d6e5',
  },
  chatLog: {
    marginTop: '6px',
    borderTop: '1px solid #1a2035',
    paddingTop: '4px',
  },
  chatMsg: {
    fontSize: '0.7rem',
    color: '#5f6d7e',
    padding: '1px 0',
  },
  chatFrom: {
    color: '#00d4aa',
    fontWeight: 600,
  },
};
