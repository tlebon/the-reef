import React, { useMemo } from 'react';

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

export default function WorldGrid({ tiles, agents, onSelectAgent }) {
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

  return (
    <div style={styles.wrapper}>
      <svg
        width={width}
        height={height}
        viewBox={`${bounds.minX * TILE_SIZE} ${bounds.minY * TILE_SIZE} ${width} ${height}`}
        style={styles.svg}
      >
        {/* Render tiles */}
        {Object.values(tiles).map(tile => {
          const key = `${tile.x},${tile.y}`;
          const agent = agentsByPos[key];
          const px = tile.x * TILE_SIZE;
          const py = tile.y * TILE_SIZE;

          return (
            <g key={key}>
              {/* Tile background */}
              <rect
                x={px + 1}
                y={py + 1}
                width={TILE_SIZE - 2}
                height={TILE_SIZE - 2}
                fill={tile.built ? RESOURCE_COLORS[tile.resource] + '40' : '#0f1623'}
                stroke={tile.built ? RESOURCE_COLORS[tile.resource] + '80' : '#1a2035'}
                strokeWidth={1}
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

              {/* Built symbol */}
              {tile.built && !agent && (
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

              {/* Agent */}
              {agent && (
                <g
                  onClick={() => onSelectAgent(agent)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={px + TILE_SIZE / 2}
                    cy={py + TILE_SIZE / 2}
                    r={TILE_SIZE / 3}
                    fill={ARCHETYPE_COLORS[agent.archetype]}
                    opacity={0.9}
                  />
                  <text
                    x={px + TILE_SIZE / 2}
                    y={py + TILE_SIZE / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0a0e17"
                    fontSize="11"
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
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
  svg: {
    background: '#060810',
    borderRadius: '4px',
  },
};
