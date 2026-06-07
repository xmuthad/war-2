# 获取真实红警2精灵图完整指南

## 当前状态

游戏目前使用的是**高质量模拟精灵图**，已经相当接近红警2原版风格。

## 获取真实精灵图的几种方式

### 方式一：购买红警2（推荐，最合法）

#### 1. 购买游戏
- **Steam**: https://store.steampowered.com/app/2229850/
- **EA App**: https://www.ea.com/games/command-and-conquer/
- 价格：通常 $9.99 - $19.99

#### 2. 安装游戏
```bash
# macOS 使用 CrossOver 或 Parallels 安装 Windows 版
# 或者使用 Steam 的 Proton 兼容层
```

#### 3. 找到游戏文件
安装后，游戏文件通常在：
```
Windows:
  C:\Program Files (x86)\Steam\steamapps\common\Command & Conquer Red Alert 2
  C:\Program Files\EA Games\Command & Conquer Red Alert 2

macOS (通过 CrossOver):
  ~/Library/Application Support/CrossOver/Bottles/RA2/drive_c/Program Files/RA2
```

#### 4. 提取精灵图
```bash
# 使用我们提供的工具
cd /Users/holgerhou/holger/dev/war
node scripts/setup-ra2-sprites.cjs

# 或者手动提取
# 1. 找到 .mix 文件（ra2.mix, ra2md.mix）
# 2. 使用 XCC Mixer 打开
# 3. 提取 .shp 文件
# 4. 使用 tools/shp-to-png.py 转换
```

### 方式二：使用 OpenRA（免费开源）

#### 1. 下载 OpenRA
```bash
# macOS
brew install --cask openra

# 或者从官网下载
# https://www.openra.net/download/
```

#### 2. 安装红警2 mod
```bash
# 运行 OpenRA
# 选择 "Red Alert 2" mod
# 首次运行会自动下载资源
```

#### 3. 找到资源文件
```
macOS:
  ~/Library/Application Support/OpenRA/Content/ra2/

Windows:
  %APPDATA%\OpenRA\Content\ra2\

Linux:
  ~/.openra/Content/ra2/
```

#### 4. 复制精灵图
```bash
# 复制到游戏目录
cp ~/Library/Application\ Support/OpenRA/Content/ra2/*.shp \
   /Users/holgerhou/holger/dev/war/temp/

# 转换
python3 tools/shp-to-png.py temp/gi.shp public/assets/sprites/units/allied_soldier.png
```

### 方式三：使用社区资源（风险自负）

一些社区网站可能提供提取好的精灵图：

#### 1. 搜索资源
- GitHub: 搜索 "Red Alert 2 sprite sheet"
- 游戏论坛: XWIS, CNCNZ 等
- Reddit: r/commandandconquer

#### 2. 验证资源
确保资源包含：
- 8个方向的动画帧
- 透明背景
- 正确的颜色调色板

### 方式四：手动绘制（最耗时但最自由）

使用像素艺术软件绘制：
- **Aseprite**: 专业像素艺术软件
- **Photoshop**: 使用铅笔工具
- **GIMP**: 免费替代方案

#### 绘制规范
```
单位精灵图:
- 尺寸: 64x64 像素每帧
- 布局: 8方向 × 4帧 = 32帧
- 总尺寸: 256x512 像素
- 格式: PNG with alpha

建筑精灵图:
- 尺寸: 128x128 像素
- 格式: PNG with alpha
```

## 精灵图文件映射

将提取的文件重命名为游戏使用的名称：

### 单位精灵图
```
public/assets/sprites/units/
├── allied_soldier.png    <- gi.shp (美国大兵)
├── soviet_soldier.png    <- e1.shp (动员兵)
├── allied_tank.png       <- htnk.shp (灰熊坦克)
├── soviet_tank.png       <- mtnk.shp (犀牛坦克)
├── allied_ifv.png        <- fv.shp (多功能步兵车)
├── soviet_apocalypse.png <- apoc.shp (天启坦克)
├── allied_prism.png      <- sref.shp (光棱坦克)
├── soviet_tesla.png      <- ttnk.shp (磁能坦克)
├── allied_miner.png      <- cmin.shp (超时空采矿车)
├── soviet_miner.png      <- harv.shp (武装采矿车)
├── allied_rocket.png     <- ggdi.shp (火箭飞行兵)
├── soviet_rocket.png     <- shk.shp (磁暴步兵)
├── allied_sniper.png     <- sniper.shp (狙击手)
├── soviet_flak.png       <- flakt.shp (防空步兵)
├── allied_engineer.png   <- engineer.shp (工程师)
├── soviet_engineer.png   <- engineer.shp (工程师)
├── tanya.png             <- tany.shp (谭雅)
├── nighthawk.png         <- shad.shp (夜鹰直升机)
├── soviet_helicopter.png <- hind.shp (武装直升机)
└── ...
```

### 建筑精灵图
```
public/assets/sprites/buildings/
├── allied_command.png    <- gacnst.shp (盟军建造厂)
├── soviet_command.png    <- nacnst.shp (苏军建造厂)
├── allied_barracks.png   <- gapile.shp (盟军兵营)
├── soviet_barracks.png   <- napile.shp (苏军兵营)
├── allied_refinery.png   <- garefn.shp (盟军矿厂)
├── soviet_refinery.png   <- narefn.shp (苏军矿厂)
├── allied_warfactory.png <- gaweap.shp (盟军战车工厂)
├── soviet_warfactory.png <- naweap.shp (苏军战车工厂)
├── allied_power.png      <- gapowr.shp (盟军发电厂)
├── soviet_power.png      <- napowr.shp (苏军发电厂)
├── allied_radar.png      <- garadr.shp (盟军雷达)
├── soviet_radar.png      <- naradr.shp (苏军雷达)
├── allied_tech.png       <- gatech.shp (盟军科技中心)
├── soviet_tech.png       <- natech.shp (苏军科技中心)
├── allied_repair.png     <- gadept.shp (盟军维修厂)
├── soviet_repair.png     <- nadept.shp (苏军维修厂)
└── ...
```

## 自动化脚本

我们提供了自动化工具：

### 检查游戏安装
```bash
node scripts/setup-ra2-sprites.cjs
```

### 生成模拟精灵图
```bash
node scripts/extract-ra2-sprites.cjs
```

### 转换 SHP 为 PNG
```bash
# 安装 Python 依赖
pip3 install pillow numpy

# 转换单个文件
python3 tools/shp-to-png.py input.shp output.png

# 批量转换
for file in temp/*.shp; do
  name=$(basename "$file" .shp)
  python3 tools/shp-to-png.py "$file" "public/assets/sprites/units/${name}.png"
done
```

## 常见问题

### Q: 转换后的精灵图颜色不对
A: 需要正确的调色板文件（.pal）。红警2使用特定的调色板文件。

### Q: 精灵图方向不正确
A: 确保方向顺序为：北、东北、东、东南、南、西南、西、西北

### Q: 透明背景变成黑色
A: 确保使用 32-bit PNG (RGBA)，索引色模式可能丢失透明信息

### Q: 动画帧数不对
A: 红警2通常使用 4-6 帧每方向，确保精灵图布局正确

## 法律声明

- 红警2精灵图版权归 Electronic Arts 所有
- 仅供个人学习和研究使用
- 请勿用于商业用途
- 建议购买正版游戏支持开发者

## 技术支持

如果遇到问题：
1. 检查精灵图格式是否正确
2. 查看浏览器控制台是否有加载错误
3. 确保文件路径正确
4. 尝试清除浏览器缓存
