import React, { useState, useEffect, useCallback } from 'react';
import { gameUIController } from '../../game/ui/GameUIController';
import { saveManager, SaveSlot, AUTO_SAVE_SLOT_ID, AUTO_SAVE_LABEL } from '../../game/systems/SaveManager';
import { useGameStore } from '../../store/gameStore';
import { Difficulty } from '../../types';
import './SaveLoadPanel.css';

interface SaveLoadPanelProps {
  mode: 'save' | 'load';
  onSave?: (slotId: string, name: string) => void;
  onLoad?: (slotId: string) => void;
  onDelete?: (slotId: string) => void;
}

export const SaveLoadPanel: React.FC<SaveLoadPanelProps> = ({
  mode,
  onSave,
  onLoad
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SaveSlot | null>(null);
  const [newSaveName, setNewSaveName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadSlots = useCallback(() => {
    try {
      const loadedSlots = saveManager.getSaveSlots();
      setSlots(loadedSlots);
    } catch (e) {
      console.error('Failed to load save slots:', e);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleOpen = useCallback(() => {
    loadSlots();
    setIsOpen(true);
    setSelectedSlot(null);
  }, [loadSlots]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedSlot(null);
    setNewSaveName('');
    setShowDeleteConfirm(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (!isOpen) {
          handleOpen();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleOpen]);

  const handleSlotClick = (slot: SaveSlot) => {
    setSelectedSlot(slot);
  };

  const handleSave = () => {
    if (!selectedSlot) return;

    const name = newSaveName.trim() || `存档 ${selectedSlot.id}`;
    const storeState = useGameStore.getState();

    const saveData = {
      version: '1.0.0',
      timestamp: Date.now(),
      gameTime: storeState.gameTime,
      faction: storeState.currentPlayer?.faction ?? 'usa' as never,
      difficulty: storeState.aiPlayers[0]?.difficulty ?? Difficulty.NORMAL,
      currentPlayer: storeState.currentPlayer,
      aiPlayers: storeState.aiPlayers,
      map: storeState.map,
      gameState: storeState.gameState,
      neutralBuildings: storeState.neutralBuildings,
      gameSettings: storeState.gameSettings,
    };

    try {
      // Capture thumbnail from game canvas
      let thumbnail: string | null = null;
      try {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas) {
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 160;
          thumbCanvas.height = 90;
          const ctx = thumbCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, 160, 90);
            thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.5);
          }
        }
      } catch { /* thumbnail capture is optional */ }

      const success = saveManager.saveGame(selectedSlot.id, name, saveData, thumbnail);
      if (success) {
        loadSlots();
        setNewSaveName('');
        setSelectedSlot(null);
        gameUIController.showNotification('游戏已保存', 'success');

        if (onSave) {
          onSave(String(selectedSlot.id), name);
        }
      } else {
        gameUIController.showNotification('保存失败', 'error');
      }
    } catch (e) {
      console.error('Failed to save:', e);
      gameUIController.showNotification('保存失败', 'error');
    }
  };

  const handleLoad = () => {
    if (!selectedSlot || !saveManager.hasSave(selectedSlot.id)) return;

    try {
      const success = saveManager.restoreGame(selectedSlot.id);
      if (success) {
        if (onLoad) {
          onLoad(String(selectedSlot.id));
        }
        handleClose();
      } else {
        gameUIController.showNotification('加载失败', 'error');
      }
    } catch (e) {
      console.error('Failed to load save:', e);
      gameUIController.showNotification('加载失败', 'error');
    }
  };

  const handleDelete = (slotId: string) => {
    const slotIndex = parseInt(slotId, 10);

    try {
      const success = saveManager.deleteSave(slotIndex);
      if (success) {
        loadSlots();
        setShowDeleteConfirm(null);

        if (selectedSlot?.id === slotIndex) {
          setSelectedSlot(null);
        }

        gameUIController.showNotification('存档已删除', 'info');
      } else {
        gameUIController.showNotification('删除失败', 'error');
      }
    } catch (e) {
      console.error('Failed to delete save:', e);
      gameUIController.showNotification('删除失败', 'error');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '未使用';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPlayTime = (seconds: number) => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button className={`saveload-button saveload-${mode}`} onClick={handleOpen} title={mode === 'save' ? '保存游戏' : '加载游戏'}>
        {mode === 'save' ? '💾' : '📂'}
      </button>
    );
  }

  return (
    <div className="saveload-overlay" onClick={handleClose}>
      <div className="saveload-panel" onClick={(e) => e.stopPropagation()}>
        <div className="saveload-header">
          <h2>{mode === 'save' ? '💾 保存游戏' : '📂 加载游戏'}</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="saveload-content">
          <div className="slots-list">
            {slots.map(slot => {
              const isAutoSave = slot.id === AUTO_SAVE_SLOT_ID;
              return (
              <div
                key={slot.id}
                className={`slot-item ${selectedSlot?.id === slot.id ? 'selected' : ''} ${!saveManager.hasSave(slot.id) ? 'empty' : 'filled'} ${isAutoSave ? 'auto-save-slot' : ''}`}
                onClick={() => handleSlotClick(slot)}
              >
                <div className="slot-thumbnail">
                  {saveManager.hasSave(slot.id) ? (
                    <div className="thumbnail-preview" style={{ backgroundColor: isAutoSave ? '#1a2d5e' : '#1a3d1a' }}>
                      <span className="preview-icon">{isAutoSave ? '🔄' : '🎮'}</span>
                    </div>
                  ) : (
                    <div className="thumbnail-empty">
                      <span>{isAutoSave ? '🔄' : '空'}</span>
                    </div>
                  )}
                </div>

                <div className="slot-info">
                  <div className="slot-name">
                    {isAutoSave ? AUTO_SAVE_LABEL : slot.name}
                    {saveManager.hasSave(slot.id) && (
                      <span className={`slot-badge ${isAutoSave ? 'auto-save-badge' : ''}`}>{isAutoSave ? '自动' : '已占用'}</span>
                    )}
                  </div>
                  <div className="slot-details">
                    <span className="slot-date">{formatDate(slot.timestamp)}</span>
                    <span className="slot-playtime">⏱️ {formatPlayTime(slot.gameTime)}</span>
                  </div>
                </div>

                <div className="slot-actions">
                  {saveManager.hasSave(slot.id) && !isAutoSave && (
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(String(slot.id));
                      }}
                      title="删除存档"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {selectedSlot && mode === 'save' && (
            <div className="save-form">
              <h3>保存到: {selectedSlot.name}</h3>
              <input
                type="text"
                className="save-name-input"
                placeholder="输入存档名称..."
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                maxLength={30}
              />
              <div className="save-info">
                <p>保存当前游戏进度到选定的存档槽位。</p>
                {saveManager.hasSave(selectedSlot.id) && (
                  <p className="warning">⚠️ 此操作将覆盖原有存档！</p>
                )}
              </div>
            </div>
          )}

          {selectedSlot && mode === 'load' && saveManager.hasSave(selectedSlot.id) && (
            <div className="load-form">
              <h3>加载: {selectedSlot.name}</h3>
              <div className="load-info">
                <p>游戏时间: {formatPlayTime(selectedSlot.gameTime)}</p>
                <p>存档时间: {formatDate(selectedSlot.timestamp)}</p>
              </div>
            </div>
          )}

          {selectedSlot && mode === 'load' && !saveManager.hasSave(selectedSlot.id) && (
            <div className="empty-slot-info">
              <h3>空存档槽</h3>
              <p>此存档槽为空，无法加载。</p>
            </div>
          )}
        </div>

        <div className="saveload-footer">
          <span className="footer-hint">按 F10 快速{mode === 'save' ? '保存' : '加载'}</span>
          <div className="footer-actions">
            <button className="cancel-btn" onClick={handleClose}>
              取消
            </button>
            {mode === 'save' ? (
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={!selectedSlot}
              >
                💾 保存
              </button>
            ) : (
              <button
                className="load-btn"
                onClick={handleLoad}
                disabled={!selectedSlot || !saveManager.hasSave(selectedSlot.id)}
              >
                📂 加载
              </button>
            )}
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-dialog">
              <h3>确认删除</h3>
              <p>确定要删除存档 "{slots.find(s => String(s.id) === showDeleteConfirm)?.name}" 吗？</p>
              <p className="warning">此操作无法撤销！</p>
              <div className="dialog-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  取消
                </button>
                <button
                  className="confirm-delete-btn"
                  onClick={() => handleDelete(showDeleteConfirm)}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
