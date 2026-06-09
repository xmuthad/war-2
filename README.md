# 红色警戒2 网页版

基于经典红色警戒2（Red Alert 2）的即时战略游戏网页版，采用 React + TypeScript + Phaser 技术构建。

## 游戏特性

### 核心玩法
- **9大阵营**：美国、英国、德国、法国、韩国（盟军）vs 苏联、古巴、利比亚、伊拉克（苏军），各阵营拥有独特单位和能力
- **21种建筑**：主基地、兵营、战车工厂、矿石精炼厂、特斯拉线圈、核弹发射井、超时空传送器等
- **30种单位**：步兵、坦克、直升机、战舰、潜艇等，含阵营专属单位（幻影坦克、天启坦克、黑鹰直升机等）
- **18种科技升级**：阵营独立科技树，含前置依赖关系
- **超级武器**：核弹、铁幕装置、超时空传送器
- **资源管理**：矿石采集、资金系统、电力系统（低电力惩罚与优先级断电）
- **AI对战**：行为树驱动的智能AI，支持简单/普通/困难/残忍四种难度
- **实时战斗**：多伤害/护甲类型、弹道模拟、溅射伤害、军衔升级（新兵/老兵/精英）
- **战役系统**：盟军/苏军独立战役，含任务目标与进度追踪
- **地图编辑器**：自定义地图创建，支持画笔/出生点/资源/填充等工具
- **存档系统**：手动存档/读档 + 自动存档

### 视觉效果
- Phaser 渲染引擎，2:1 等距投影
- 战争迷雾系统（隐藏/已探索/可见三种状态）
- 7种天气效果（晴/多云/雨/雪/雾/暴风/沙暴）
- 昼夜循环系统
- 9种战斗特效（爆炸/枪口闪光/烟雾/火花/弹道/治疗/建造/特斯拉/超时空）
- 移动/攻击/采集指示器与路径线
- 雷达扫描与警报系统

### 操作方式
- **鼠标左键**：选择单位/建筑，框选多单位
- **鼠标右键**：移动/攻击/采集/占领
- **空格键**：暂停/继续
- **ESC**：取消选择
- **1-9**：编队快速选择
- **Ctrl+1-9**：创建编队
- **A**：攻击移动
- **S**：停止
- **H**：守卫姿态
- **D**：部署/展开

## 技术栈

- **前端框架**：React 18
- **类型系统**：TypeScript
- **渲染引擎**：Phaser 4
- **状态管理**：Zustand + Immer
- **构建工具**：Vite
- **样式**：Tailwind CSS + 自定义CSS
- **测试**：Vitest（单元测试）+ Playwright（E2E测试）

## 项目结构

```
src/
├── components/
│   └── ui/
│       ├── Menu.tsx              # 主菜单（阵营/难度/地图选择、教程、成就）
│       ├── GameCanvas.tsx        # 游戏画布容器
│       ├── GameUI.tsx            # 游戏主界面（单位选择、命令面板、右键菜单）
│       ├── ResourceBar.tsx       # 资源栏（资金、电力、超级武器充能）
│       ├── BuildPanel.tsx        # 建造面板（建筑/单位/科技三标签）
│       ├── Minimap.tsx           # 小地图导航
│       ├── MapEditor.tsx         # 地图编辑器
│       ├── MapPreview.tsx        # 地图预览
│       ├── CampaignSelect.tsx    # 战役选择
│       ├── MissionBriefing.tsx   # 任务简报
│       ├── MissionDebriefing.tsx # 任务结算
│       ├── PlayerSetup.tsx       # 玩家设置（最多7个AI）
│       ├── SaveLoadPanel.tsx     # 存档/读档面板
│       ├── SettingsPanel.tsx     # 设置面板（图形/音频/玩法/控制）
│       ├── Scoreboard.tsx        # 记分板
│       ├── ShortcutsOverlay.tsx  # 快捷键帮助
│       └── PerformanceOverlay.tsx # 性能监控
├── game/
│   ├── engine/
│   │   ├── GameEngine.ts         # 游戏引擎（60FPS循环、1x-4x速度）
│   │   ├── InputHandler.ts       # 输入处理器（选择/命令/超级武器）
│   │   └── InputManager.ts       # 输入管理器（鼠标/键盘事件）
│   ├── data/
│   │   ├── units.ts              # 30种单位数据
│   │   ├── buildings.ts          # 21种建筑数据
│   │   ├── upgrades.ts           # 18种科技升级
│   │   └── achievements.ts       # 25个成就
│   ├── map/
│   │   ├── MapManager.ts         # 地图管理器
│   │   └── MapPresets.ts         # 地图预设（6+张地图）
│   ├── render/
│   │   ├── PhaserGameScene.ts    # Phaser主场景（渲染/输入/相机）
│   │   ├── PhaserConfig.ts       # 精灵图与渲染配置
│   │   ├── FogOfWar.ts           # 战争迷雾
│   │   ├── EffectSystem.ts       # 特效系统
│   │   ├── WeatherSystem.ts      # 天气系统
│   │   ├── DayNightCycle.ts      # 昼夜循环
│   │   ├── IndicatorSystem.ts    # 指示器系统
│   │   ├── IsometricUtils.ts     # 等距投影工具
│   │   └── usePhaser.ts          # React Hook
│   ├── systems/
│   │   ├── AIBrain.ts            # AI大脑（行为树决策）
│   │   ├── AIBehaviorTree.ts     # 行为树实现
│   │   ├── AIController.ts       # AI控制器
│   │   ├── AITasks.ts            # AI任务定义
│   │   ├── AIGameCommands.ts     # AI游戏命令
│   │   ├── CombatSystem.ts       # 战斗系统
│   │   ├── CombatUpdateSystem.ts # 战斗更新
│   │   ├── MovementSystem.ts     # 移动系统
│   │   ├── PathfindingManager.ts # A*寻路
│   │   ├── HarvestSystem.ts      # 采集系统
│   │   ├── AutoHarvestSystem.ts  # 自动采集
│   │   ├── ProductionSystem.ts   # 生产系统
│   │   ├── PowerSystem.ts        # 电力系统
│   │   ├── FactionSystem.ts      # 阵营系统
│   │   ├── AttackWaveSystem.ts   # 攻击波系统
│   │   ├── AutoEngageSystem.ts   # 自动交战
│   │   ├── CaptureSystem.ts      # 占领系统
│   │   ├── RepairSystem.ts       # 维修系统
│   │   ├── VictoryConditionSystem.ts # 胜利条件
│   │   ├── MissionSystem.ts      # 任务系统
│   │   ├── RadarAlertSystem.ts   # 雷达警报
│   │   ├── GameSoundManager.ts   # 音效管理
│   │   ├── HotkeyManager.ts      # 快捷键管理
│   │   ├── SaveManager.ts        # 存档管理
│   │   ├── StatisticsSystem.ts   # 统计系统
│   │   ├── PerformanceMonitor.ts # 性能监控
│   │   ├── GameEventBus.ts       # 事件总线
│   │   ├── GameEventBridge.ts    # 事件桥接
│   │   ├── SystemManager.ts      # 系统管理器
│   │   └── campaigns.ts          # 战役数据
│   └── config/
│       ├── GameConfig.ts         # 游戏核心参数
│       ├── TerrainConfig.ts      # 地形配置（12种地形）
│       ├── AIConfig.ts           # AI配置（4级难度）
│       └── FactionTheme.ts       # 阵营主题色
├── store/
│   └── gameStore.ts              # 全局状态（Zustand + Immer）
├── types/
│   └── index.ts                  # 完整类型定义
└── App.tsx                       # 应用入口
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173/

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npm run check
```

### 运行测试

```bash
# 单元测试
npm run test

# E2E测试
npm run test:e2e
```

## 游戏说明

### 盟军特色
- **幻影坦克**（法国）：伪装能力，高伤害
- **光棱坦克**：远程攻击，可集合攻击
- **黑鹰直升机**（韩国）：高级空中单位
- **超时空军团兵**：瞬间传送
- **谭雅**：精英步兵，C4炸药
- **间谍卫星**：全局视野升级

### 苏军特色
- **天启坦克**：双管炮塔，重型装甲
- **磁能坦克**：电磁攻击
- **基洛夫飞艇**：重型轰炸机
- **恐怖分子**（古巴）：自爆攻击
- **疯狂伊文**（利比亚）：炸弹专家
- **核弹发射井**：终极超级武器

### 资源系统
- **矿石**：地图上分布，由采矿车采集
- **资金**：用于建造建筑和生产单位，初始5000
- **电力**：建筑消耗电力，电力不足时按优先级断电

### 胜利条件
- 全灭敌方单位与建筑
- 摧毁敌方主基地
- 占领指定建筑
- 限时生存
- 经济胜利

## 许可证

MIT License
