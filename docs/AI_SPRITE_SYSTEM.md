# AI精灵图生成系统

## 完整指南

欢迎使用红警2游戏的AI精灵图生成系统！

## 系统概览

```
AI工具 → 生成原始图像 → 后处理脚本 → 游戏精灵图
DALL-E      ai-sprites/     scripts/       public/assets/
Midjourney
Stable Diffusion
```

## 快速开始

### 1. 阅读提示词库

打开 `scripts/generate-quick-prompts.txt`

### 2. 使用AI生成精灵图

复制提示词，粘贴到DALL-E/Midjourney/Stable Diffusion

### 3. 保存到ai-sprites/

```
ai-sprites/
├── allied-soldier.png
├── soviet-soldier.png
├── allied-tank.png
├── soviet-tank.png
└── ...
```

### 4. 运行后处理

```bash
node scripts/process-ai-sprites.cjs
```

### 5. 测试游戏

```bash
npm run dev
```

打开 http://localhost:5176/ 查看效果

## 目录结构

```
/Users/holgerhou/holger/dev/war/
├── docs/
│   ├── AI_SPRITE_GENERATION.md  # 详细生成指南
│   ├── AI_SPRITE_SYSTEM.md      # 本文档
│   └── GET_REAL_RA2_SPRITES.md  # 获取红警2原始资源
├── scripts/
│   ├── process-ai-sprites.cjs   # AI精灵图后处理
│   ├── generate-quick-prompts.txt # 快速提示词
│   └── ...
├── ai-sprites/                   # AI生成的原始精灵图
└── public/assets/sprites/        # 游戏使用的精灵图
    ├── units/
    └── buildings/
```

## 工作流程

```
1. 选择要生成的单位
   ↓
2. 复制对应的提示词
   ↓
3. 在AI工具中生成
   ↓
4. 保存PNG到ai-sprites/目录
   ↓
5. 运行后处理脚本
   ↓
6. 自动复制到public/assets/sprites/
   ↓
7. 在游戏中查看效果
```

## 精灵图规格

### 单位精灵图
- **尺寸：** 256x512 像素
- **布局：** 8个方向 × 4帧动画
- **每帧：** 64x64 像素

### 建筑精灵图
- **尺寸：** 128x128 像素
- **布局：** 单帧

## AI提示词

### 美国大兵
```
pixel art sprite sheet, US army soldier in battle gear, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, blue uniform, green helmet, holding M16 rifle, retro pixel art, transparent background
```

### 动员兵
```
pixel art sprite sheet, Soviet infantry soldier, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, red uniform, ushanka hat, holding AK-47, retro pixel art, transparent background
```

### 灰熊坦克
```
pixel art sprite sheet, light tank, top-down view, 8 directions, moving animation 4 frames, 64x64 pixels, red alert 2 style, blue NATO tank, dark grey tracks, turret with cannon, retro pixel art, transparent background
```

### 犀牛坦克
```
pixel art sprite sheet, heavy battle tank, top-down view, 8 directions, moving animation 4 frames, 64x64 pixels, red alert 2 style, red Soviet tank, heavy armor, dark grey tracks, large turret, retro pixel art, transparent background
```

## 后处理功能

`process-ai-sprites.cjs` 自动：
- 像素化处理
- 优化透明度
- 去除噪点
- 对齐网格
- 自动分类（单位/建筑）

## 颜色参考

```
盟军蓝: #4A7FB5
苏军红: #8B2020
皮肤色: #E8B896
履带黑: #1A1A1A
高亮蓝: #87CEEB
红色星: #FFD700
```

## 方向顺序

游戏期望的方向顺序：
1. 北 (上)
2. 东北
3. 东 (右)
4. 东南
5. 南 (下)
6. 西南
7. 西 (左)
8. 西北

## 常见问题

### Q: 找不到ai-sprites目录
A: 运行 mkdir ai-sprites 创建目录

### Q: 后处理脚本不工作
A: 确保安装了依赖：npm install

### Q: AI生成的精灵图不好看
A: 尝试不同的提示词，调整AI参数

### Q: 想换回程序生成的精灵图
A: 运行: node scripts/extract-ra2-sprites.cjs

## 获取更好的精灵图

### 方案1: 购买红警2（最真实）
- Steam: https://store.steampowered.com/app/2229850/
- 提取原始资源

### 方案2: 使用OpenRA（免费）
- 网址: https://www.openra.net/
- 开源资源

### 方案3: AI生成（当前方案）
- 可定制
- 快速迭代
- 无需版权问题

## 相关文档

- [AI_SPRITE_GENERATION.md](./AI_SPRITE_GENERATION.md) - 详细生成指南
- [GET_REAL_RA2_SPRITES.md](./GET_REAL_RA2_SPRITES.md) - 获取红警2原始资源
- [RA2_SPRITES.md](./RA2_SPRITES.md) - 精灵图系统说明

## 下一步

1. 打开 `scripts/generate-quick-prompts.txt`
2. 选择你要生成的单位
3. 复制提示词
4. 使用AI生成
5. 保存到ai-sprites/
6. 运行后处理
7. 测试游戏

祝好运！🎮
