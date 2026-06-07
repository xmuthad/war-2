# AI精灵图生成指南

## 概览

使用AI图像生成工具（如DALL-E、Midjourney、Stable Diffusion）生成红警2风格的像素精灵图。

## 精灵图规格

### 单位精灵图

**尺寸：** 256x512 像素
**布局：** 8个方向 × 4帧动画
**每帧：** 64x64 像素
**格式：** PNG with alpha通道 (32-bit)
**风格：** 像素艺术，红警2风格俯视角

```
  方向0 (北)   [帧0][帧1][帧2][帧3]
  方向1 (东北) [帧0][帧1][帧2][帧3]
  方向2 (东)   [帧0][帧1][帧2][帧3]
  方向3 (东南) [帧0][帧1][帧2][帧3]
  方向4 (南)   [帧0][帧1][帧2][帧3]
  方向5 (西南) [帧0][帧1][帧2][帧3]
  方向6 (西)   [帧0][帧1][帧2][帧3]
  方向7 (西北) [帧0][帧1][帧2][帧3]
```

### 建筑精灵图

**尺寸：** 128x128 像素
**布局：** 单帧
**格式：** PNG with alpha通道 (32-bit)
**风格：** 像素艺术，红警2风格

## AI提示词库

### 通用提示词模式

```
pixel art sprite sheet, [subject], top-down isometric view, 8 directions, 4 frames per direction, 64x64 pixels per frame, red alert 2 style, retro computer game graphics, transparent background, high contrast, sharp pixels
```

### 具体单位提示词

#### 美国大兵 (Allied Soldier)
```
pixel art sprite sheet, US army soldier in battle gear, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, blue uniform, green helmet, holding M16 rifle, retro pixel art, transparent background
```

#### 动员兵 (Soviet Soldier)
```
pixel art sprite sheet, Soviet infantry soldier, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, red uniform, ushanka hat, holding AK-47, retro pixel art, transparent background
```

#### 灰熊坦克 (Allied Tank)
```
pixel art sprite sheet, light tank, top-down view, 8 directions, moving animation 4 frames, 64x64 pixels, red alert 2 style, blue NATO tank, dark grey tracks, turret with cannon, retro pixel art, transparent background
```

#### 犀牛坦克 (Soviet Tank)
```
pixel art sprite sheet, heavy battle tank, top-down view, 8 directions, moving animation 4 frames, 64x64 pixels, red alert 2 style, red Soviet tank, heavy armor, dark grey tracks, large turret, retro pixel art, transparent background
```

#### 光棱坦克 (Prism Tank)
```
pixel art sprite sheet, futuristic prism laser tank, top-down view, 8 directions, 4 animation frames, 64x64 pixels, red alert 2 style, blue high-tech tank with large prism laser on turret, glowing blue crystals, retro pixel art, transparent background
```

#### 天启坦克 (Apocalypse Tank)
```
pixel art sprite sheet, super heavy battle tank, top-down view, 8 directions, 4 animation frames, 64x64 pixels, red alert 2 style, dark red Soviet tank with double cannons and missile launchers, massive treads, retro pixel art, transparent background
```

#### 工程师 (Engineer)
```
pixel art sprite sheet, military engineer with toolbox, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, tan uniform with yellow safety vest, hard hat, carrying wrench, retro pixel art, transparent background
```

#### 谭雅 (Tanya)
```
pixel art sprite sheet, female commando, top-down view, 8 directions, walking animation 4 frames, 64x64 pixels, red alert 2 style, black bodysuit, blonde hair, dual pistols, action hero pose, retro pixel art, transparent background
```

### 建筑提示词

#### 盟军建造厂
```
pixel art building, allied construction yard, top-down isometric view, 128x128 pixels, red alert 2 style, blue factory building with crane, industrial design, large entrance, retro pixel art, transparent background
```

#### 苏军建造厂
```
pixel art building, Soviet construction yard, top-down isometric view, 128x128 pixels, red alert 2 style, red fortress building with towers, industrial design, Stalinist architecture, retro pixel art, transparent background
```

#### 盟军兵营
```
pixel art building, allied barracks, top-down isometric view, 128x128 pixels, red alert 2 style, blue military barracks with flag pole, soldiers entrance, retro pixel art, transparent background
```

#### 苏军兵营
```
pixel art building, Soviet barracks, top-down isometric view, 128x128 pixels, red alert 2 style, red military building with Soviet star, troop entrance, retro pixel art, transparent background
```

## 推荐AI工具

### 1. DALL-E 3 (最简单)
- **网址：** https://chat.openai.com/
- **优点：** 容易使用，理解复杂提示词
- **缺点：** 像素艺术控制有限

### 2. Midjourney (高质量)
- **网址：** https://www.midjourney.com/
- **优点：** 高质量，像素艺术效果好
- **缺点：** 需要Discord

### 3. Stable Diffusion (最佳控制)
- **网址：** https://stablediffusionweb.com/ 或本地安装
- **优点：** 完全控制，可以使用LoRA训练
- **缺点：** 需要技术知识

### 4. 像素艺术专用工具
- **Pixar Pixel Art**: https://www.pixar.com/ (不是皮克斯！)
- **Pixel Art Studio**: 在线工具
- **Aseprite**: 配合AI插件

## 工作流程

### 步骤1：生成草图
使用AI生成概念图，确认风格正确

### 步骤2：生成完整精灵图
使用提示词生成完整的8×4精灵图

### 步骤3：后处理
1. 调整透明度
2. 对齐网格
3. 优化像素
4. 添加阴影

### 步骤4：测试
放入游戏目录测试效果

## 后处理脚本

我们提供了自动化后处理工具：

```bash
# 运行AI精灵图后处理
node scripts/process-ai-sprites.cjs
```

## 文件名映射

将AI生成的文件重命名为：

```
public/assets/sprites/
├── units/
│   ├── allied_soldier.png    <- 美国大兵
│   ├── soviet_soldier.png    <- 动员兵
│   ├── allied_tank.png       <- 灰熊坦克
│   ├── soviet_tank.png       <- 犀牛坦克
│   ├── allied_prism.png      <- 光棱坦克
│   └── soviet_apocalypse.png <- 天启坦克
└── buildings/
    ├── allied_command.png    <- 盟军建造厂
    ├── soviet_command.png    <- 苏军建造厂
    ├── allied_barracks.png   <- 盟军兵营
    └── soviet_barracks.png   <- 苏军兵营
```

## 技巧和窍门

### 提示词技巧
- 使用 "pixel art" 而不是 "sprite"（AI更容易理解）
- 指定 "top-down view" 或 "isometric"
- 强调 "retro computer game graphics"
- 要求 "transparent background"
- 指定像素尺寸

### 颜色参考
```
盟军蓝: #4A7FB5
苏军红: #8B2020
皮肤色: #E8B896
履带黑: #1A1A1A
```

### 方向顺序
确保方向按此顺序排列：
1. 北 (上)
2. 东北
3. 东 (右)
4. 东南
5. 南 (下)
6. 西南
7. 西 (左)
8. 西北

## 示例提示词模板

```
[STYLE] pixel art sprite sheet, [SUBJECT], [VIEW], [ANIMATION], [SIZE], red alert 2 video game style, retro 90s computer game graphics, [COLORS], transparent background, sharp clean pixels, high contrast, pixel-perfect

替换为：
[STYLE]: "16-bit", "32-bit", "retro", "classic"
[SUBJECT]: your unit/building description
[VIEW]: "top-down view", "isometric top-down view", "bird's eye view"
[ANIMATION]: "8 directions, 4 walking frames per direction"
[SIZE]: "64x64 pixels each frame"
[COLORS]: optional specific colors
```

## 常见问题

### Q: AI生成的方向顺序不对
A: 在提示词中明确指定方向顺序，或手动重新排列

### Q: 像素不够清晰
A: 使用 "sharp clean pixels", "pixel-perfect", "high contrast"

### Q: 透明背景不工作
A: 在提示词末尾添加 "on transparent background, alpha channel"

### Q: 动画不流畅
A: 确保4帧显示循环动画（walk cycle）

## 下一步

1. 阅读完整提示词库
2. 尝试用AI生成
3. 使用后处理工具优化
4. 放入游戏测试
