import React, { useEffect, useState } from 'react';
import { gameUIController } from '../../game/ui/GameUIController';
import './ShortcutsOverlay.css';

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutItem[];
}

interface ShortcutItem {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS_DATA: ShortcutCategory[] = [
  {
    name: '移动与攻击',
    shortcuts: [
      { key: 'G', description: '移动到指定位置', category: 'move' },
      { key: 'A', description: '攻击指定目标', category: 'move' },
      { key: 'P', description: '巡逻', category: 'move' },
      { key: 'F', description: '防守', category: 'move' },
      { key: 'H', description: '采集资源', category: 'move' },
      { key: 'S', description: '停止当前动作', category: 'move' },
      { key: 'D', description: '警戒模式', category: 'move' },
      { key: 'K', description: '强制攻击', category: 'move' },
      { key: 'R', description: '撤退', category: 'move' }
    ]
  },
  {
    name: '编队与选择',
    shortcuts: [
      { key: 'Ctrl+1-9', description: '编队 1-9', category: 'selection' },
      { key: '1-9', description: '选择编队 1-9', category: 'selection' },
      { key: 'Tab', description: '选择下一个单位', category: 'selection' },
      { key: 'Shift+Tab', description: '选择上一个单位', category: 'selection' },
      { key: 'Ctrl+A', description: '全选所有同类单位', category: 'selection' },
      { key: 'Ctrl+点击', description: '追加选择', category: 'selection' },
      { key: '双击', description: '选择屏幕内所有同类单位', category: 'selection' },
      { key: '框选', description: '框选多个单位', category: 'selection' }
    ]
  },
  {
    name: '建筑操作',
    shortcuts: [
      { key: 'B', description: '打开建造菜单', category: 'building' },
      { key: 'Q', description: '设置集结点', category: 'building' },
      { key: 'R', description: '修理建筑', category: 'building' },
      { key: 'Del', description: '出售建筑', category: 'building' },
      { key: 'E', description: '进入建筑', category: 'building' }
    ]
  },
  {
    name: '界面操作',
    shortcuts: [
      { key: 'F1', description: '显示快捷键帮助', category: 'ui' },
      { key: 'M', description: '展开/收起小地图', category: 'ui' },
      { key: 'Alt+A', description: '切换界面动画', category: 'ui' },
      { key: 'Esc', description: '取消当前操作', category: 'ui' },
      { key: '空格', description: '聚焦主基地', category: 'ui' },
      { key: 'Delete', description: '删除/出售', category: 'ui' },
      { key: 'Enter', description: '聊天/确认', category: 'ui' }
    ]
  },
  {
    name: '视角控制',
    shortcuts: [
      { key: 'W/↑', description: '向上移动', category: 'camera' },
      { key: 'S/↓', description: '向下移动', category: 'camera' },
      { key: 'A/←', description: '向左移动', category: 'camera' },
      { key: 'D/→', description: '向右移动', category: 'camera' },
      { key: '滚轮', description: '缩放视角', category: 'camera' },
      { key: 'N', description: '下一个警报', category: 'camera' },
      { key: 'Home', description: '回到起始位置', category: 'camera' }
    ]
  },
  {
    name: '战斗指令',
    shortcuts: [
      { key: 'N', description: '下一个敌人', category: 'combat' },
      { key: 'Alt+点击', description: '攻击移动', category: 'combat' },
      { key: 'Ctrl+Shift+点击', description: '分散攻击', category: 'combat' }
    ]
  }
];

export const ShortcutsOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = gameUIController.subscribe((state) => {
      setIsVisible(state.showShortcutsOverlay);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        gameUIController.toggleShortcutsOverlay();
      } else if (e.key === 'Escape' && isVisible) {
        gameUIController.toggleShortcutsOverlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const filteredShortcuts = SHORTCUTS_DATA.map(category => ({
    ...category,
    shortcuts: category.shortcuts.filter(shortcut =>
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.key.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.shortcuts.length > 0);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      gameUIController.toggleShortcutsOverlay();
    }
  };

  return (
    <div className="shortcuts-overlay" onClick={handleBackdropClick}>
      <div className="shortcuts-panel">
        <div className="shortcuts-header">
          <h2>快捷键帮助</h2>
          <button
            className="close-button"
            onClick={() => gameUIController.toggleShortcutsOverlay()}
          >
            ✕
          </button>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="搜索快捷键..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="shortcuts-content">
          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === null ? 'active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              全部
            </button>
            {SHORTCUTS_DATA.map(category => (
              <button
                key={category.name}
                className={`category-tab ${activeCategory === category.name ? 'active' : ''}`}
                onClick={() => setActiveCategory(
                  activeCategory === category.name ? null : category.name
                )}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="shortcuts-list">
            {filteredShortcuts.map(category => (
              (!activeCategory || activeCategory === category.name) && (
                <div key={category.name} className="shortcut-category">
                  <h3>{category.name}</h3>
                  <div className="shortcut-items">
                    {category.shortcuts.map(shortcut => (
                      <div key={shortcut.key} className="shortcut-item">
                        <kbd className="shortcut-key">{shortcut.key}</kbd>
                        <span className="shortcut-description">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="shortcuts-footer">
          <span className="tip">按</span>
          <kbd>Esc</kbd>
          <span className="tip">或</span>
          <kbd>F1</kbd>
          <span className="tip">关闭</span>
        </div>
      </div>
    </div>
  );
};
