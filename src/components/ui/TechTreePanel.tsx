import React, { useMemo } from 'react';
import { BuildingType, BuildingData, Faction, FactionGroup, getFactionGroup } from '../../types';
import { BUILDINGS_BY_FACTION } from '../../game/systems/AIUnitLookup';
import { useGameStore } from '../../store/gameStore';

interface TechTreePanelProps {
  onClose: () => void;
}

interface BuildingNode {
  type: BuildingType;
  data: BuildingData;
  status: 'built' | 'canBuild' | 'missingPrereqs' | 'unavailable';
  tier: number;
}

const BUILDING_ICONS: Record<string, string> = {
  [BuildingType.COMMAND]: '🏛️',
  [BuildingType.REFINERY]: '🏭',
  [BuildingType.BARRACKS]: '🏕️',
  [BuildingType.WARFACTORY]: '🔧',
  [BuildingType.POWER]: '⚡',
  [BuildingType.HELIPAD]: '🚁',
  [BuildingType.AIRFIELD]: '✈️',
  [BuildingType.RADAR]: '📡',
  [BuildingType.TECH]: '🔬',
  [BuildingType.REPAIR]: '🔨',
  [BuildingType.WALL]: '🧱',
  [BuildingType.TURRET]: '🔫',
  [BuildingType.DEFENSE]: '🛡️',
  [BuildingType.FLAME_TOWER]: '🔥',
  [BuildingType.TESLA_COIL]: '⚡',
  [BuildingType.NAVAL_SHIPYARD]: '⚓',
  [BuildingType.NUCLEAR_SILO]: '☢️',
  [BuildingType.IRON_CURTAIN]: '🛡️',
  [BuildingType.CHRONOSPHERE]: '🌀',
  [BuildingType.PATRIOT]: '🚀',
  [BuildingType.SENTRY_GUN]: '🔫',
  [BuildingType.BATTLE_BUNKER]: '🏰',
  [BuildingType.CLONING_VATS]: '🧬',
  [BuildingType.INDUSTRIAL_PLANT]: '🏗️',
  [BuildingType.PSYCHIC_SENSOR]: '👁️',
  [BuildingType.GAP_GENERATOR]: '🌫️',
  [BuildingType.NUCLEAR_REACTOR]: '☢️',
  [BuildingType.FLAK_CANNON]: '🎯',
  [BuildingType.SPY_SATELLITE]: '🛰️',
  [BuildingType.ORE_PURIFIER]: '💎',
  [BuildingType.GRAND_CANNON]: '💣',
};

function computeTier(buildings: Partial<Record<BuildingType, BuildingData>>, type: BuildingType, memo: Map<BuildingType, number> = new Map()): number {
  if (memo.has(type)) return memo.get(type)!;
  const data = buildings[type];
  if (!data) { memo.set(type, 0); return 0; }
  if (data.requiredBuildings.length === 0) { memo.set(type, 0); return 0; }
  let maxPrereqTier = 0;
  for (const req of data.requiredBuildings) {
    const reqTier = computeTier(buildings, req, memo);
    maxPrereqTier = Math.max(maxPrereqTier, reqTier);
  }
  const tier = maxPrereqTier + 1;
  memo.set(type, tier);
  return tier;
}

export const TechTreePanel: React.FC<TechTreePanelProps> = ({ onClose }) => {
  const currentPlayer = useGameStore(s => s.currentPlayer);

  const factionGroup = currentPlayer ? getFactionGroup(currentPlayer.faction) : FactionGroup.ALLIED;
  const faction = currentPlayer?.faction ?? Faction.USA;

  const { alliedNodes, sovietNodes, connections } = useMemo(() => {
    const alliedBuildings = [Faction.USA, Faction.BRITAIN, Faction.GERMANY, Faction.FRANCE, Faction.KOREA]
      .reduce<Partial<Record<BuildingType, BuildingData>>>((acc, f) => {
        const fBuildings = BUILDINGS_BY_FACTION[f];
        for (const [type, data] of Object.entries(fBuildings)) {
          if (!acc[type as BuildingType]) {
            acc[type as BuildingType] = data as BuildingData;
          }
        }
        return acc;
      }, {});

    const sovietBuildings = [Faction.SOVIET, Faction.CUBA, Faction.LIBYA, Faction.IRAQ]
      .reduce<Partial<Record<BuildingType, BuildingData>>>((acc, f) => {
        const fBuildings = BUILDINGS_BY_FACTION[f];
        for (const [type, data] of Object.entries(fBuildings)) {
          if (!acc[type as BuildingType]) {
            acc[type as BuildingType] = data as BuildingData;
          }
        }
        return acc;
      }, {});

    const builtTypes = new Set(currentPlayer?.buildings.filter(b => b.isConstructed).map(b => b.type) ?? []);

    const factionBuildings = BUILDINGS_BY_FACTION[faction] ?? {};

    function buildNodes(buildings: Partial<Record<BuildingType, BuildingData>>): BuildingNode[] {
      const tierMemo = new Map<BuildingType, number>();
      const nodes: BuildingNode[] = [];

      for (const [type, data] of Object.entries(buildings)) {
        const bt = type as BuildingType;
        const bd = data as BuildingData;
        // Skip neutral-only buildings
        if (bd.faction === Faction.NEUTRAL) continue;
        // Skip wall (not meaningful in tech tree)
        if (bt === BuildingType.WALL) continue;

        const tier = computeTier(buildings, bt, tierMemo);
        let status: BuildingNode['status'];

        if (builtTypes.has(bt)) {
          status = 'built';
        } else if (!(bt in factionBuildings)) {
          status = 'unavailable';
        } else {
          const prereqsMet = bd.requiredBuildings.every(req => builtTypes.has(req));
          status = prereqsMet ? 'canBuild' : 'missingPrereqs';
        }

        nodes.push({ type: bt, data: bd, status, tier });
      }

      return nodes.sort((a, b) => a.tier - b.tier || a.data.name.localeCompare(b.data.name));
    }

    function buildConnections(buildings: Partial<Record<BuildingType, BuildingData>>): Array<{ from: BuildingType; to: BuildingType }> {
      const conns: Array<{ from: BuildingType; to: BuildingType }> = [];
      for (const [type, data] of Object.entries(buildings)) {
        const bt = type as BuildingType;
        const bd = data as BuildingData;
        if (bd.faction === Faction.NEUTRAL) continue;
        for (const req of bd.requiredBuildings) {
          conns.push({ from: req, to: bt });
        }
      }
      return conns;
    }

    return {
      alliedNodes: buildNodes(alliedBuildings),
      sovietNodes: buildNodes(sovietBuildings),
      connections: {
        allied: buildConnections(alliedBuildings),
        soviet: buildConnections(sovietBuildings),
      },
    };
  }, [faction, currentPlayer]);

  const activeNodes = factionGroup === FactionGroup.ALLIED ? alliedNodes : sovietNodes;
  const inactiveNodes = factionGroup === FactionGroup.ALLIED ? sovietNodes : alliedNodes;
  const activeConnections = factionGroup === FactionGroup.ALLIED ? connections.allied : connections.soviet;
  const inactiveConnections = factionGroup === FactionGroup.ALLIED ? connections.soviet : connections.allied;

  const renderTree = (nodes: BuildingNode[], conns: Array<{ from: BuildingType; to: BuildingType }>, label: string, isActive: boolean) => {
    const tiers: Map<number, BuildingNode[]> = new Map();
    for (const node of nodes) {
      if (!tiers.has(node.tier)) tiers.set(node.tier, []);
      tiers.get(node.tier)!.push(node);
    }
    const sortedTiers = Array.from(tiers.entries()).sort((a, b) => a[0] - b[0]);

    // Build a position map for drawing lines
    const nodePositions: Map<BuildingType, { tier: number; index: number; total: number }> = new Map();
    for (const [tier, tierNodes] of sortedTiers) {
      for (let i = 0; i < tierNodes.length; i++) {
        nodePositions.set(tierNodes[i].type, { tier, index: i, total: tierNodes.length });
      }
    }

    return (
      <div key={label} className={`tech-tree-section ${isActive ? 'active' : 'inactive'}`}>
        <h3 className="tech-tree-section-title">{label}</h3>
        <div className="tech-tree-grid">
          {sortedTiers.map(([tier, tierNodes]) => (
            <div key={tier} className="tech-tree-tier">
              <div className="tech-tree-tier-label">等级 {tier}</div>
              <div className="tech-tree-tier-nodes">
                {tierNodes.map(node => {
                  const icon = BUILDING_ICONS[node.type] || '🏢';
                  const hasPrereqs = node.data.requiredBuildings.length > 0;
                  return (
                    <div
                      key={node.type}
                      className={`tech-tree-node tech-tree-node-${node.status}`}
                      title={`${node.data.name}\n费用: $${node.data.cost}\n电力: ${node.data.powerOutput > 0 ? '+' + node.data.powerOutput : '-' + node.data.powerConsumption}${hasPrereqs ? '\n前置: ' + node.data.requiredBuildings.map(r => r).join(', ') : ''}`}
                    >
                      <div className="tech-tree-node-icon">{icon}</div>
                      <div className="tech-tree-node-name">{node.data.name}</div>
                      <div className="tech-tree-node-cost">${node.data.cost}</div>
                      <div className="tech-tree-node-power">
                        {node.data.powerOutput > 0 ? `+${node.data.powerOutput}` : `-${node.data.powerConsumption}`}
                      </div>
                      {hasPrereqs && (
                        <div className="tech-tree-node-prereqs">
                          {node.data.requiredBuildings.map(req => {
                            const built = currentPlayer?.buildings.some(b => b.type === req && b.isConstructed);
                            return (
                              <span key={req} className={`prereq-tag ${built ? 'prereq-met' : 'prereq-unmet'}`}>
                                {BUILDING_ICONS[req] || '?'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {/* Connection lines drawn via CSS pseudo-elements */}
                      {conns.filter(c => c.to === node.type).map(c => (
                        <div key={`conn-${c.from}-${c.to}`} className="tech-tree-connector incoming" />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="tech-tree-overlay" onClick={onClose}>
      <div className="tech-tree-panel" onClick={e => e.stopPropagation()}>
        <div className="tech-tree-header">
          <h2>科技树</h2>
          <div className="tech-tree-legend">
            <span className="legend-item"><span className="legend-dot legend-dot-built" /> 已建造</span>
            <span className="legend-item"><span className="legend-dot legend-dot-canBuild" /> 可建造</span>
            <span className="legend-item"><span className="legend-dot legend-dot-missingPrereqs" /> 缺前置</span>
            <span className="legend-item"><span className="legend-dot legend-dot-unavailable" /> 不可用</span>
          </div>
          <button className="tech-tree-close" onClick={onClose}>✕</button>
        </div>
        <div className="tech-tree-content">
          {renderTree(activeNodes, activeConnections, factionGroup === FactionGroup.ALLIED ? '盟军' : '苏军', true)}
          {renderTree(inactiveNodes, inactiveConnections, factionGroup === FactionGroup.ALLIED ? '苏军' : '盟军', false)}
        </div>
      </div>
    </div>
  );
};
