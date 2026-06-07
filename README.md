# 红色警戒2 网页版

基于经典红色警戒2（Red Alert 2）的即时战略游戏网页版，采用React + TypeScript + HTML5 Canvas技术构建。

## 游戏特性

### 🎮 核心玩法
- **完整阵营系统**：盟军 vs 苏军两大阵营
- **建筑建造**：主基地、兵营、战车工厂、矿石精炼厂等建筑
- **单位生产**：步兵、坦克、直升机等多种单位
- **资源管理**：矿石采集、资金系统、电力系统
- **AI对战**：智能AI敌人，支持简单/普通/困难三种难度
- **实时战斗**：兵种相克、攻击判定、伤害计算

### 🎨 视觉效果
- 现代WebGL Canvas渲染
- 复古军事主题UI设计
- 实时血条显示
- 小地图导航
- 建造进度显示

### ⌨️ 操作方式
- **鼠标左键**：选择单位/建筑
- **鼠标右键**：移动/攻击/采集
- **空格键**：暂停/继续
- **ESC**：取消选择
- **1-9**：快速选择单位

## 技术栈

- **前端框架**：React 18
- **类型系统**：TypeScript
- **状态管理**：Zustand
- **构建工具**：Vite
- **渲染技术**：HTML5 Canvas 2D
- **样式**：Tailwind CSS + 自定义CSS

## 项目结构

```
src/
├── components/
│   └── ui/
│       ├── Menu.tsx          # 主菜单
│       ├── GameCanvas.tsx    # 游戏画布
│       ├── ResourceBar.tsx   # 资源栏
│       ├── BuildPanel.tsx    # 建造面板
│       └── GameUI.tsx        # 游戏UI
├── game/
│   ├── engine/
│   │   ├── GameEngine.ts     # 游戏引擎
│   │   └── InputManager.ts   # 输入管理
│   ├── data/
│   │   ├── units.ts          # 单位数据
│   │   └── buildings.ts       # 建筑数据
│   ├── map/
│   │   ├── GameMap.ts        # 地图生成
│   │   └── MapManager.ts     # 地图管理
│   ├── render/
│   │   └── Canvas2DRenderer.ts # 渲染系统
│   └── systems/
│       └── AIController.ts    # AI系统
├── store/
│   └── gameStore.ts          # 游戏状态
├── types/
│   └── index.ts              # 类型定义
└── App.tsx                   # 应用入口
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

## 游戏说明

### 盟军特色
- **幻影坦克**：高伤害、高护甲
- **光棱坦克**：远程攻击，可集合攻击
- **夜鹰直升机**：快速空中单位

### 苏军特色
- **天启坦克**：双管炮塔，重型装甲
- **磁能坦克**：电磁攻击
- **武装直升机**：空中优势

### 资源系统
- **矿石**：地图上随机分布，由采矿车采集
- **资金**：用于建造建筑和生产单位
- **电力**：建筑消耗电力，电力不足时效率降低

### 胜利条件
摧毁敌方主基地即可获得胜利！

## 开发团队

这是一个从头构建的红色警戒2风格RTS游戏，使用现代Web技术完整复刻经典玩法。

## 许可证

MIT License
