import React, { useState, useEffect } from 'react';
import { useGameStore, UNIT_UPGRADE_REQUIREMENTS } from '../../store/gameStore';
import { BuildingType, UnitType, BuildingData, UnitData, UpgradeType, getFactionGroup } from '../../types';
import { BUILDINGS_BY_FACTION, UNITS_BY_FACTION } from '../../game/systems/AIUnitLookup';
import { UPGRADES, getUpgradesByFactionGroup } from '../../game/data/upgrades';
import { gameEventBus } from '../../game/systems/GameEventBus';
import './BuildPanel.css';

type TabType = 'buildings' | 'units' | 'tech';

export const BuildPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('buildings');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [flashItem, setFlashItem] = useState<string | null>(null);
  const { currentPlayer, selectedBuilding, produceUnit, placementBuildingType, startBuildingPlacement, cancelBuildingPlacement, researchUpgrade, cancelProduction } = useGameStore();

  // Tab hotkeys: 1/2/3 switch tabs only when no units are selected (to avoid conflict with control groups)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      // Only switch tabs when no units are selected, to avoid conflicting with control group selection (1-9)
      const state = useGameStore.getState();
      if (state.selectedUnits.length > 0) return;

      if (e.key === '1') setActiveTab('buildings');
      else if (e.key === '2') setActiveTab('units');
      else if (e.key === '3') setActiveTab('tech');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentPlayer) return null;

  const buildings = BUILDINGS_BY_FACTION[currentPlayer.faction] || {};
  const units = UNITS_BY_FACTION[currentPlayer.faction] || {};

  const canBuildBuilding = (buildingType: BuildingType): boolean => {
    const data = buildings[buildingType];
    if (!data) return false;
    if (currentPlayer.money < data.cost) return false;

    const requiredBuildings = data.requiredBuildings || [];
    return requiredBuildings.every(req =>
      currentPlayer.buildings.some(b => b.type === req && b.isConstructed)
    );
  };

  const handleBuildBuilding = (buildingType: BuildingType) => {
    const data = buildings[buildingType];
    if (!data) return;

    // Check money first
    if (currentPlayer.money < data.cost) {
      gameEventBus.emit('ui:notification', { message: `资金不足！需要 $${data.cost}`, type: 'warning' });
      return;
    }

    // Check required buildings
    const requiredBuildings = data.requiredBuildings || [];
    const missingPrereqs = requiredBuildings.filter(req =>
      !currentPlayer.buildings.some(b => b.type === req && b.isConstructed)
    );
    if (missingPrereqs.length > 0) {
      const prereqNames = missingPrereqs.map(req => buildings[req]?.name || req).join('、');
      gameEventBus.emit('ui:notification', { message: `需要先建造: ${prereqNames}`, type: 'warning' });
      return;
    }

    // If already in placement mode for this building, cancel
    if (placementBuildingType === buildingType) {
      cancelBuildingPlacement();
      return;
    }

    startBuildingPlacement(buildingType);
  };

  const handleProduceUnit = (unitType: UnitType) => {
    if (!selectedBuilding) return;
    // Check queue limit
    if (selectedBuilding.productionQueue.length >= 5) {
      gameEventBus.emit('ui:notification', { message: '生产队列已满', type: 'warning' });
      return;
    }

    const unitData = units[unitType];
    if (!unitData) return;
    if (currentPlayer.money < unitData.cost) {
      gameEventBus.emit('ui:notification', { message: `资源不足，需要 $${unitData.cost}`, type: 'warning' });
      return;
    }

    produceUnit(selectedBuilding.id, unitType);

    // Visual flash feedback
    setFlashItem(unitType);
    setTimeout(() => setFlashItem(null), 300);

    // Audio feedback
    gameEventBus.emit('sound:play', { key: 'uiClick' });
  };

  const getBuildItemTooltip = (type: string, data: BuildingData | UnitData | undefined, isAffordable: boolean): string => {
    if (!data) return type;
    const lines = [data.name || type];
    lines.push(`费用: $${data.cost || 0}`);
    if (!isAffordable) lines.push('⚠ 资源不足');
    if ('attack' in data && data.attack) lines.push(`攻击: ${data.attack}`);
    if ('armor' in data && data.armor) lines.push(`护甲: ${data.armor}`);
    if ('speed' in data && data.speed) lines.push(`速度: ${data.speed}`);
    return lines.join('\n');
  };

  const renderBuildingTab = () => (
    <div className="build-grid">
      {Object.entries(buildings)
        .filter(([type]) => type !== BuildingType.COMMAND)
        .map(([type, data]) => {
          const canBuild = canBuildBuilding(type as BuildingType);
          const isHovered = hoveredItem === type;

          // Determine missing prerequisites for tooltip/hint
          const missingPrereqs: string[] = [];
          if (!canBuild && data) {
            if (currentPlayer.money < data.cost) {
              missingPrereqs.push(`资金 $${data.cost}`);
            }
            const requiredBuildings = data.requiredBuildings || [];
            for (const req of requiredBuildings) {
              if (!currentPlayer.buildings.some(b => b.type === req && b.isConstructed)) {
                missingPrereqs.push(buildings[req]?.name || req);
              }
            }
          }

          return (
            <div
              key={type}
              className={`build-item ${canBuild ? '' : 'disabled'} ${isHovered ? 'hovered' : ''} ${placementBuildingType === type ? 'placing' : ''}`}
              onClick={() => handleBuildBuilding(type as BuildingType)}
              onMouseEnter={() => setHoveredItem(type)}
              onMouseLeave={() => setHoveredItem(null)}
              title={placementBuildingType === type ? '点击地图放置建筑 (右键取消)' : getBuildItemTooltip(type, data, canBuild)}
              role="button"
              aria-label={`建造 ${data?.name || type}`}
              tabIndex={canBuild ? 0 : -1}
            >
              <div className="build-icon-wrapper">
                <div className="build-icon" style={{ backgroundColor: canBuild ? '#555' : '#333' }} />
                {!canBuild && data?.cost && currentPlayer.money < data.cost && (
                  <div className="build-icon-overlay">💰</div>
                )}
              </div>
              <div className="build-info">
                <div className="build-name">{data?.name || type}</div>
                <div className={`build-cost ${canBuild ? 'affordable' : 'expensive'}`}>
                  ${data?.cost || 0}
                </div>
              </div>
              {!canBuild && missingPrereqs.length > 0 && (
                <div className="build-prereq-hint">
                  需要: {missingPrereqs.join('、')}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );

  const renderUnitTab = () => {
    // Check if selected building can produce anything
    const canProduceAnything = selectedBuilding && selectedBuilding.canProduce && selectedBuilding.canProduce.length > 0;
    const producibleUnits = canProduceAnything
      ? Object.entries(units).filter(([type]) => selectedBuilding!.canProduce.includes(type as UnitType))
      : [];

    return (
      <div className="build-grid">
        {!selectedBuilding ? (
          <div className="build-no-selection">
            <span className="no-selection-icon">🏭</span>
            <span>请先选择一个生产建筑</span>
          </div>
        ) : !canProduceAnything ? (
          <div className="build-no-selection">
            <span className="no-selection-icon">🚫</span>
            <span>此建筑无法生产单位</span>
          </div>
        ) : (
          producibleUnits.map(([type, data]) => {
        const requiredUpgrade = UNIT_UPGRADE_REQUIREMENTS[type as UnitType];
        const hasRequiredUpgrade = !requiredUpgrade || currentPlayer.researchedUpgrades.includes(requiredUpgrade);
        const isLockedByUpgrade = !hasRequiredUpgrade;
        const canBuild = !isLockedByUpgrade && data?.cost !== undefined && currentPlayer.money >= data.cost;
        const isHovered = hoveredItem === type;

        let tooltipText = getBuildItemTooltip(type, data, !!canBuild);
        if (isLockedByUpgrade && requiredUpgrade) {
          const upgradeName = UPGRADES[requiredUpgrade]?.name || requiredUpgrade;
          tooltipText = `🔒 需要科技: ${upgradeName}\n${tooltipText}`;
        }

        return (
          <div
            key={type}
            className={`build-item ${canBuild ? '' : 'disabled'} ${isLockedByUpgrade ? 'locked-upgrade' : ''} ${isHovered ? 'hovered' : ''} ${flashItem === type ? 'flash' : ''}`}
            onClick={() => canBuild && handleProduceUnit(type as UnitType)}
            onMouseEnter={() => setHoveredItem(type)}
            onMouseLeave={() => setHoveredItem(null)}
            title={tooltipText}
            role="button"
            aria-label={`生产 ${data?.name || type}`}
            tabIndex={canBuild ? 0 : -1}
          >
            <div className="build-icon-wrapper">
              <div className="build-icon unit-icon" style={{ backgroundColor: canBuild ? '#666' : isLockedByUpgrade ? '#222' : '#333' }} />
              {isLockedByUpgrade && (
                <div className="build-icon-overlay">🔒</div>
              )}
            </div>
            <div className="build-info">
              <div className={`build-name ${isLockedByUpgrade ? 'locked-name' : ''}`}>{data?.name || type}</div>
              <div className={`build-cost ${canBuild ? 'affordable' : 'expensive'}`}>
                ${data?.cost || 0}
              </div>
            </div>
          </div>
        );
      })
      )}
    </div>
    );
  };

  const canResearchUpgrade = (upgradeType: UpgradeType): boolean => {
    const upgrade = UPGRADES[upgradeType];
    if (!upgrade) return false;
    if (currentPlayer.money < upgrade.cost) return false;
    if (currentPlayer.researchedUpgrades.includes(upgradeType)) return false;
    if (currentPlayer.researchQueue.some(q => q.upgradeType === upgradeType)) return false;
    if (currentPlayer.researchQueue.length >= 1) return false;

    const hasAllRequired = upgrade.requiredBuildings.every(req =>
      currentPlayer.buildings.some(b => b.type === req && b.isConstructed)
    );
    return hasAllRequired;
  };

  const handleResearchUpgrade = (upgradeType: UpgradeType) => {
    if (!canResearchUpgrade(upgradeType)) {
      const upgrade = UPGRADES[upgradeType];
      if (upgrade && currentPlayer.money < upgrade.cost) {
        gameEventBus.emit('ui:notification', { message: `资源不足，需要 $${upgrade.cost}`, type: 'warning' });
      }
      return;
    }
    researchUpgrade(upgradeType);
  };

  const renderTechTab = () => {
    const factionGroup = getFactionGroup(currentPlayer.faction);
    const availableUpgrades = getUpgradesByFactionGroup(factionGroup);
    const researchQueue = currentPlayer.researchQueue;

    return (
      <div className="build-grid">
        {availableUpgrades.map((upgrade) => {
          const isResearched = currentPlayer.researchedUpgrades.includes(upgrade.type);
          const isResearching = researchQueue.some(q => q.upgradeType === upgrade.type);
          const canResearch = canResearchUpgrade(upgrade.type);
          const isHovered = hoveredItem === upgrade.type;
          const researchingItem = researchQueue.find(q => q.upgradeType === upgrade.type);
          const progress = researchingItem
            ? Math.max(0, Math.min(100, (researchingItem.progress / researchingItem.totalTime) * 100))
            : 0;

          return (
            <div
              key={upgrade.type}
              className={`build-item ${isResearched ? 'completed' : ''} ${isResearching ? 'researching' : ''} ${!isResearched && !isResearching && canResearch ? '' : 'disabled'} ${isHovered ? 'hovered' : ''}`}
              onClick={() => !isResearched && !isResearching && handleResearchUpgrade(upgrade.type)}
              onMouseEnter={() => setHoveredItem(upgrade.type)}
              onMouseLeave={() => setHoveredItem(null)}
              title={`${upgrade.name}\n${upgrade.description}\n效果: ${upgrade.effect}\n费用: $${upgrade.cost}\n时间: ${upgrade.researchTime}s`}
              role="button"
              aria-label={`研究 ${upgrade.name}`}
              tabIndex={!isResearched && !isResearching && canResearch ? 0 : -1}
            >
              <div className="build-icon-wrapper">
                <div className={`build-icon ${isResearched ? 'upgrade-completed-icon' : 'upgrade-icon'}`} style={{ backgroundColor: isResearched ? '#2a4a2a' : isResearching ? '#2a3a4a' : canResearch ? '#555' : '#333' }}>
                  {isResearched ? '✓' : isResearching ? '⏳' : '🔬'}
                </div>
                {isResearching && (
                  <div className="upgrade-progress-ring">
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#1a2a3a" strokeWidth="2" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-primary)" strokeWidth="2"
                        strokeDasharray={`${progress} 100`}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="build-info">
                <div className="build-name">{upgrade.name}</div>
                {isResearched ? (
                  <div className="build-cost completed-cost">已完成</div>
                ) : isResearching ? (
                  <div className="build-cost researching-cost">{Math.floor(progress)}%</div>
                ) : (
                  <div className={`build-cost ${canResearch ? 'affordable' : 'expensive'}`}>
                    ${upgrade.cost}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="build-panel" role="region" aria-label="建造面板">
      {placementBuildingType && (
        <div className="placement-banner">
          <span>📌 点击地图放置建筑</span>
          <button className="placement-cancel-btn" onClick={cancelBuildingPlacement}>✕ 取消</button>
        </div>
      )}
      <div className="build-tabs" role="tablist">
        <button
          className={`tab ${activeTab === 'buildings' ? 'active' : ''}`}
          onClick={() => setActiveTab('buildings')}
          role="tab"
          aria-selected={activeTab === 'buildings'}
          aria-controls="build-content"
        >
          <span className="tab-icon">🏗️</span>
          <span>建筑</span>
        </button>
        <button
          className={`tab ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
          role="tab"
          aria-selected={activeTab === 'units'}
          aria-controls="build-content"
        >
          <span className="tab-icon">⚔️</span>
          <span>单位</span>
        </button>
        <button
          className={`tab ${activeTab === 'tech' ? 'active' : ''}`}
          onClick={() => setActiveTab('tech')}
          role="tab"
          aria-selected={activeTab === 'tech'}
          aria-controls="build-content"
        >
          <span className="tab-icon">🔬</span>
          <span>科技</span>
        </button>
      </div>

      <div className="build-content" id="build-content" role="tabpanel">
        {activeTab === 'buildings' ? renderBuildingTab() : activeTab === 'units' ? renderUnitTab() : renderTechTab()}
      </div>

      {selectedBuilding && selectedBuilding.productionQueue.length > 0 && (
        <div className="production-queue">
          <div className="queue-title">
            <span>生产队列</span>
            <span className="queue-count">{selectedBuilding.productionQueue.length}/5</span>
          </div>
          <div className="queue-items">
            {selectedBuilding.productionQueue.map((item, index) => {
              const unitData = units[item.type as UnitType];
              const displayName = unitData?.name || item.type;
              const progress = Math.max(0, Math.min(100, (item.progress / item.totalTime) * 100));
              return (
                <div
                  key={item.id}
                  className={`queue-item ${index === 0 ? 'active' : ''}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    cancelProduction(selectedBuilding!.id, index);
                  }}
                  title="右键点击取消生产"
                >
                  <div className="queue-item-icon">{index === 0 ? '⏳' : '⏱️'}</div>
                  <div className="queue-item-info">
                    <span className="queue-item-type">{displayName}</span>
                    <div className="queue-progress-bar">
                      <div
                        className="queue-progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="queue-percent">
                    {Math.floor(progress)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
