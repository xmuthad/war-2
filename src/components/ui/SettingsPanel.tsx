import React, { useState, useEffect, useCallback } from 'react';
import { gameUIController } from '../../game/ui/GameUIController';
import { useGameStore } from '../../store/gameStore';
import './SettingsPanel.css';

export interface GameSettings {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  gameplay: GameplaySettings;
  controls: ControlsSettings;
}

export interface GraphicsSettings {
  resolution: 'low' | 'medium' | 'high' | 'ultra';
  textureQuality: 'low' | 'medium' | 'high';
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  particleEffects: boolean;
  antialiasing: boolean;
  vsync: boolean;
  maxFPS: number;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muteOnFocusLost: boolean;
}

export interface GameplaySettings {
  gameSpeed: number;
  showDamageNumbers: boolean;
  showHealthBars: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  showTips: boolean;
  colorBlindMode: boolean;
}

export interface ControlsSettings {
  scrollSpeed: number;
  edgeScrolling: boolean;
  cameraSmoothing: number;
  hotkeyPreset: 'default' | 'custom';
}

const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    resolution: 'high',
    textureQuality: 'medium',
    shadowQuality: 'medium',
    particleEffects: true,
    antialiasing: true,
    vsync: true,
    maxFPS: 60
  },
  audio: {
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 80,
    voiceVolume: 100,
    muteOnFocusLost: false
  },
  gameplay: {
    gameSpeed: 1,
    showDamageNumbers: true,
    showHealthBars: true,
    autoSave: true,
    autoSaveInterval: 5,
    showTips: true,
    colorBlindMode: false
  },
  controls: {
    scrollSpeed: 10,
    edgeScrolling: true,
    cameraSmoothing: 0.5,
    hotkeyPreset: 'default'
  }
};

type SettingsCategory = 'graphics' | 'audio' | 'gameplay' | 'controls';

export const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('graphics');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const handleOpen = () => setIsOpen(true);
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (confirm('有未保存的更改，确定要关闭吗？')) {
        setIsOpen(false);
        setHasChanges(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [hasChanges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const updateSetting = <K extends keyof GameSettings>(
    category: K,
    key: keyof GameSettings[K],
    value: string | number | boolean
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem('gameSettings', JSON.stringify(settings));
    setHasChanges(false);
    gameUIController.showNotification('设置已保存', 'success');
  };

  const handleReset = () => {
    if (confirm('确定要恢复默认设置吗？')) {
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(true);
    }
  };

  const handleApply = () => {
    handleSave();
    // Apply game speed to store
    const store = useGameStore.getState();
    if (store.setGameSpeed) {
      store.setGameSpeed(settings.gameplay.gameSpeed as 1 | 2 | 3 | 4);
    }
    // Apply audio volume via game event bus
    try {
      const { gameEventBus } = require('../../game/systems/GameEventBus');
      gameEventBus.emit('settings:volumeChanged', {
        master: settings.audio.masterVolume / 100,
        music: settings.audio.musicVolume / 100,
        sfx: settings.audio.sfxVolume / 100,
      });
    } catch { /* Event bus not available */ }
  };

  if (!isOpen) {
    return (
      <button className="settings-button" onClick={handleOpen} title="设置">
        ⚙️
      </button>
    );
  }

  const renderSlider = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    min: number = 0,
    max: number = 100,
    unit: string = ''
  ) => (
    <div className="setting-item">
      <div className="setting-label">
        <span>{label}</span>
        <span className="setting-value">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="setting-slider"
      />
    </div>
  );

  const renderToggle = (
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
    description?: string
  ) => (
    <div className="setting-item toggle-item">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {description && <span className="setting-description">{description}</span>}
      </div>
      <button
        className={`toggle-switch ${value ? 'active' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className="toggle-slider"></span>
      </button>
    </div>
  );

  const renderSelect = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ) => (
    <div className="setting-item">
      <span className="setting-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="setting-select"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  const renderGraphicsSettings = () => (
    <div className="settings-section">
      <h3>图像设置</h3>

      {renderSelect(
        '分辨率',
        settings.graphics.resolution,
        [
          { value: 'low', label: '低 (800x600)' },
          { value: 'medium', label: '中 (1280x720)' },
          { value: 'high', label: '高 (1920x1080)' },
          { value: 'ultra', label: '极致 (2560x1440)' }
        ],
        (v) => updateSetting('graphics', 'resolution', v)
      )}

      {renderSelect(
        '纹理质量',
        settings.graphics.textureQuality,
        [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' }
        ],
        (v) => updateSetting('graphics', 'textureQuality', v)
      )}

      {renderSelect(
        '阴影质量',
        settings.graphics.shadowQuality,
        [
          { value: 'off', label: '关闭' },
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' }
        ],
        (v) => updateSetting('graphics', 'shadowQuality', v)
      )}

      {renderSlider(
        '最大帧率',
        settings.graphics.maxFPS,
        (v) => updateSetting('graphics', 'maxFPS', v),
        30,
        144,
        ' FPS'
      )}

      {renderToggle(
        '粒子效果',
        settings.graphics.particleEffects,
        (v) => updateSetting('graphics', 'particleEffects', v)
      )}

      {renderToggle(
        '抗锯齿',
        settings.graphics.antialiasing,
        (v) => updateSetting('graphics', 'antialiasing', v)
      )}

      {renderToggle(
        '垂直同步',
        settings.graphics.vsync,
        (v) => updateSetting('graphics', 'vsync', v)
      )}
    </div>
  );

  const renderAudioSettings = () => (
    <div className="settings-section">
      <h3>音频设置</h3>

      {renderSlider(
        '主音量',
        settings.audio.masterVolume,
        (v) => updateSetting('audio', 'masterVolume', v),
        0,
        100,
        '%'
      )}

      {renderSlider(
        '音乐音量',
        settings.audio.musicVolume,
        (v) => updateSetting('audio', 'musicVolume', v),
        0,
        100,
        '%'
      )}

      {renderSlider(
        '音效音量',
        settings.audio.sfxVolume,
        (v) => updateSetting('audio', 'sfxVolume', v),
        0,
        100,
        '%'
      )}

      {renderSlider(
        '语音音量',
        settings.audio.voiceVolume,
        (v) => updateSetting('audio', 'voiceVolume', v),
        0,
        100,
        '%'
      )}

      {renderToggle(
        '失去焦点时静音',
        settings.audio.muteOnFocusLost,
        (v) => updateSetting('audio', 'muteOnFocusLost', v)
      )}
    </div>
  );

  const renderGameplaySettings = () => (
    <div className="settings-section">
      <h3>游戏设置</h3>

      {renderSlider(
        '游戏速度',
        settings.gameplay.gameSpeed,
        (v) => updateSetting('gameplay', 'gameSpeed', v),
        1,
        3,
        'x'
      )}

      {renderToggle(
        '显示伤害数字',
        settings.gameplay.showDamageNumbers,
        (v) => updateSetting('gameplay', 'showDamageNumbers', v)
      )}

      {renderToggle(
        '显示血条',
        settings.gameplay.showHealthBars,
        (v) => updateSetting('gameplay', 'showHealthBars', v)
      )}

      {renderToggle(
        '自动保存',
        settings.gameplay.autoSave,
        (v) => updateSetting('gameplay', 'autoSave', v)
      )}

      {settings.gameplay.autoSave && renderSlider(
        '自动保存间隔',
        settings.gameplay.autoSaveInterval,
        (v) => updateSetting('gameplay', 'autoSaveInterval', v),
        1,
        30,
        ' 分钟'
      )}

      {renderToggle(
        '显示提示',
        settings.gameplay.showTips,
        (v) => updateSetting('gameplay', 'showTips', v)
      )}

      {renderToggle(
        '色盲模式',
        settings.gameplay.colorBlindMode,
        (v) => updateSetting('gameplay', 'colorBlindMode', v)
      )}
    </div>
  );

  const renderControlsSettings = () => (
    <div className="settings-section">
      <h3>控制设置</h3>

      {renderSlider(
        '滚动速度',
        settings.controls.scrollSpeed,
        (v) => updateSetting('controls', 'scrollSpeed', v),
        1,
        20
      )}

      {renderSlider(
        '相机平滑度',
        Math.round(settings.controls.cameraSmoothing * 100),
        (v) => updateSetting('controls', 'cameraSmoothing', v / 100),
        0,
        100,
        '%'
      )}

      {renderToggle(
        '边缘滚动',
        settings.controls.edgeScrolling,
        (v) => updateSetting('controls', 'edgeScrolling', v)
      )}

      {renderSelect(
        '快捷键预设',
        settings.controls.hotkeyPreset,
        [
          { value: 'default', label: '默认' },
          { value: 'custom', label: '自定义' }
        ],
        (v) => updateSetting('controls', 'hotkeyPreset', v)
      )}

      <div className="setting-item">
        <button className="hotkey-config-btn" onClick={() => gameUIController.toggleShortcutsOverlay()}>
          📋 配置快捷键
        </button>
      </div>
    </div>
  );

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ 设置</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeCategory === 'graphics' ? 'active' : ''}`}
              onClick={() => setActiveCategory('graphics')}
            >
              🖼️ 图像
            </button>
            <button
              className={`tab-btn ${activeCategory === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveCategory('audio')}
            >
              🔊 音频
            </button>
            <button
              className={`tab-btn ${activeCategory === 'gameplay' ? 'active' : ''}`}
              onClick={() => setActiveCategory('gameplay')}
            >
              🎮 游戏
            </button>
            <button
              className={`tab-btn ${activeCategory === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveCategory('controls')}
            >
              ⌨️ 控制
            </button>
          </div>

          <div className="settings-body">
            {activeCategory === 'graphics' && renderGraphicsSettings()}
            {activeCategory === 'audio' && renderAudioSettings()}
            {activeCategory === 'gameplay' && renderGameplaySettings()}
            {activeCategory === 'controls' && renderControlsSettings()}
          </div>
        </div>

        <div className="settings-footer">
          <button className="reset-btn" onClick={handleReset}>
            恢复默认
          </button>
          <div className="footer-actions">
            <button className="cancel-btn" onClick={handleClose}>
              取消
            </button>
            <button className="apply-btn" onClick={handleApply}>
              应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
