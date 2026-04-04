import React, { useMemo, useState, useRef, useCallback } from 'react';

const TILE_SIZE = 40;
const RESOURCE_COLORS = {
  coral:   '#ff6b6b',
  crystal: '#a29bfe',
  kelp:    '#00b894',
  shell:   '#fdcb6e',
};
const ARCHETYPE_COLORS = {
  builder:  '#ff6b6b',
  merchant: '#fdcb6e',
  scout:    '#00b894',
  crafter:  '#a29bfe',
};

export default function WorldGrid({ tiles, agents, onSelectAgent, onSelectTile, myAgentId }) {
  // Compute grid bounds from tiles
  const bounds = useMemo(() => {
    const coords = Object.values(tiles).map(t => ({ x: t.x, y: t.y }));
    if (coords.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return {
      minX: Math.min(...coords.map(c => c.x)) - 1,
      maxX: Math.max(...coords.map(c => c.x)) + 1,
      minY: Math.min(...coords.map(c => c.y)) - 1,
      maxY: Math.max(...coords.map(c => c.y)) + 1,
    };
  }, [tiles]);

  // Build agent position lookup
  const agentsByPos = useMemo(() => {
    const map = {};
    for (const a of agents) {
      map[`${a.x},${a.y}`] = a;
    }
    return map;
  }, [agents]);

  const width = (bounds.maxX - bounds.minX + 1) * TILE_SIZE;
  const height = (bounds.maxY - bounds.minY + 1) * TILE_SIZE;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
      dragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      style={styles.wrapper}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={e => e.preventDefault()}
    >
      <svg
        width={width}
        height={height}
        viewBox={`${bounds.minX * TILE_SIZE} ${bounds.minY * TILE_SIZE} ${width} ${height}`}
        style={{ ...styles.svg, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}
      >
        {/* Render tiles */}
        {Object.values(tiles).map(tile => {
          const key = `${tile.x},${tile.y}`;
          const agent = agentsByPos[key];
          const px = tile.x * TILE_SIZE;
          const py = tile.y * TILE_SIZE;

          const isMyAgent = agent && agent.id === myAgentId;

          return (
            <g key={key} onClick={() => agent ? onSelectAgent(agent) : onSelectTile(tile)} style={{ cursor: 'pointer' }}>
              {/* Tile background */}
              <rect
                x={px + 1}
                y={py + 1}
                width={TILE_SIZE - 2}
                height={TILE_SIZE - 2}
                fill={tile.built ? RESOURCE_COLORS[tile.resource] + '40' : '#0f1623'}
                stroke={isMyAgent ? '#00d4aa' : tile.built ? RESOURCE_COLORS[tile.resource] + '80' : '#1a2035'}
                strokeWidth={isMyAgent ? 2 : 1}
                rx={2}
              />

              {/* Resource dot */}
              {!tile.built && (
                <circle
                  cx={px + TILE_SIZE / 2}
                  cy={py + TILE_SIZE / 2}
                  r={3}
                  fill={RESOURCE_COLORS[tile.resource] + '60'}
                />
              )}

              {/* Built symbol — always show */}
              {tile.built && (
                <text
                  x={px + TILE_SIZE / 2}
                  y={py + TILE_SIZE / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={RESOURCE_COLORS[tile.resource]}
                  fontSize="16"
                  fontFamily="monospace"
                >
                  {tile.symbol}
                </text>
              )}

              {/* Agent — small indicator in top-right corner */}
              {agent && (
                <g>
                  <circle
                    cx={px + TILE_SIZE - 8}
                    cy={py + 8}
                    r={6}
                    fill={ARCHETYPE_COLORS[agent.archetype]}
                    stroke={isMyAgent ? '#00d4aa' : '#0a0e17'}
                    strokeWidth={1.5}
                  />
                  <text
                    x={px + TILE_SIZE - 8}
                    y={py + 9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0a0e17"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </text>
                </g>
              )}

              {/* Coordinates (subtle) */}
              <text
                x={px + 3}
                y={py + TILE_SIZE - 3}
                fill="#1a2035"
                fontSize="7"
                fontFamily="monospace"
              >
                {tile.x},{tile.y}
              </text>
            </g>
          );
        })}

        {/* Fog effect — void cells in the bounding box that don't have tiles */}
        {(() => {
          const voidCells = [];
          for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
              if (!tiles[`${x},${y}`]) {
                voidCells.push(
                  <rect
                    key={`void-${x},${y}`}
                    x={x * TILE_SIZE + 1}
                    y={y * TILE_SIZE + 1}
                    width={TILE_SIZE - 2}
                    height={TILE_SIZE - 2}
                    fill="#060810"
                    rx={2}
                  />
                );
              }
            }
          }
          return voidCells;
        })()}
      </svg>
      <div style={styles.hint}>scroll to zoom · alt+drag to pan · WASD to move</div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    position: 'relative',
  },
  hint: {
    position: 'absolute',
    bottom: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.65rem',
    color: '#2d3748',
    pointerEvents: 'none',
  },
  svg: {
    background: '#060810',
    borderRadius: '4px',
  },
};
