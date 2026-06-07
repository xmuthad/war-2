# 红警2精灵图使用指南

## 当前状态

目前游戏使用的是程序生成的模拟红警2风格精灵图。这些精灵图位于：
- `public/assets/sprites/units/` - 单位精灵图
- `public/assets/sprites/buildings/` - 建筑精灵图

## 使用真实红警2精灵图

要获得最接近原版红警2的视觉效果，建议使用真实的游戏精灵图。

### 方法一：从红警2游戏文件提取（推荐）

#### 1. 获取红警2游戏文件
需要以下文件：
- `ra2.mix` 或 `ra2md.mix` - 游戏主资源文件
- `language.mix` - 语言资源

#### 2. 使用 XCC Mixer 提取

XCC Mixer 是 Westwood 游戏资源提取工具：

```bash
# 下载 XCC Mixer
# 官网：http://xhp.xwis.net/

# 打开 ra2.mix 文件
# 导航到 -> units/ 目录
# 提取以下文件：
# - gi.shp (美国大兵)
# - e1.shp (动员兵)
# - htank.shp (灰熊坦克)
# - mtank.shp (犀牛坦克)
# - etc.

# 建筑精灵图在 -> buildings/ 目录
# - gacnst.shp (盟军建造厂)
# - nacnst.shp (苏军建造厂)
# - gapile.shp (盟军兵营)
# - napile.shp (苏军兵营)
```

#### 3. 转换 SHP 为 PNG

使用 OpenRA 的转换工具：

```bash
# 安装 OpenRA 转换工具
npm install -g openra-convert

# 转换 SHP 为 PNG
openra-convert shp-to-png gi.shp gi.png
openra-convert shp-to-png e1.shp e1.png
```

或者使用 Python 脚本：

```python
# 需要安装 pillow
# pip install pillow

from PIL import Image
import struct

def read_shp(filename):
    """读取 SHP 文件并转换为图片列表"""
    with open(filename, 'rb') as f:
        # SHP 文件头
        header = f.read(14)
        count = struct.unpack('<H', header[0:2])[0]
        
        images = []
        for i in range(count):
            # 读取每帧数据
            # 具体格式取决于 SHP 版本
            pass
        
        return images
```

### 方法二：使用 OpenRA 资源

OpenRA 是红警的开源重制版，提供了提取好的资源：

1. 下载 OpenRA：https://www.openra.net/
2. 安装并运行一次，让它提取资源
3. 找到提取的精灵图：
   - Windows: `%APPDATA%\OpenRA\Content\ra2\`
   - macOS: `~/Library/Application Support/OpenRA/Content/ra2/`
   - Linux: `~/.openra/Content/ra2/`

### 方法三：使用社区资源包

一些社区项目提供了提取好的精灵图：

- **C&C Asset Browser**: https://github.com/Phrohdoh/OpenRA
- **RA2 Sprite Pack**: 搜索 "Red Alert 2 sprite sheet"

## 精灵图格式规范

### 单位精灵图

文件名格式：`{faction}_{unit_type}.png`

尺寸：256x512 像素（4帧 × 8方向）

布局：
```
方向0 (北)    [帧0][帧1][帧2][帧3]
方向1 (东北)   [帧0][帧1][帧2][帧3]
方向2 (东)     [帧0][帧1][帧2][帧3]
方向3 (东南)   [帧0][帧1][帧2][帧3]
方向4 (南)     [帧0][帧1][帧2][帧3]
方向5 (西南)   [帧0][帧1][帧2][帧3]
方向6 (西)     [帧0][帧1][帧2][帧3]
方向7 (西北)   [帧0][帧1][帧2][帧3]
```

每帧：64x64 像素

### 建筑精灵图

文件名格式：`{faction}_{building_type}.png`

尺寸：128x128 像素

## 替换精灵图

将提取或生成的精灵图放入对应目录：

```
public/assets/sprites/
├── units/
│   ├── allied_soldier.png    # 替换为 gi.png
│   ├── soviet_soldier.png    # 替换为 e1.png
│   ├── allied_tank.png       # 替换为 htank.png
│   ├── soviet_tank.png       # 替换为 mtank.png
│   └── ...
└── buildings/
    ├── allied_command.png    # 替换为 gacnst.png
    ├── soviet_command.png    # 替换为 nacnst.png
    ├── allied_barracks.png   # 替换为 gapile.png
    ├── soviet_barracks.png   # 替换为 napile.png
    └── ...
```

## 注意事项

1. **版权问题**：红警2精灵图版权归 EA 所有，仅供个人学习使用
2. **透明度**：确保 PNG 文件有正确的透明通道
3. **颜色深度**：建议使用 32-bit PNG（RGBA）
4. **尺寸一致**：所有帧的尺寸必须相同

## 自动化脚本

提供了自动化提取脚本：

```bash
# 安装依赖
npm install

# 生成模拟精灵图
npm run generate-sprites

# 如果你有 RA2 游戏文件，使用真实精灵图
# 将 .mix 文件放入 tools/ra2/ 目录
npm run extract-ra2-sprites
```

## 故障排除

### 精灵图显示为黑色方块
- 检查 PNG 是否有透明通道
- 确保文件路径正确

### 动画不流畅
- 检查帧数是否为 4 的倍数
- 确保每帧尺寸相同

### 方向不正确
- 检查精灵图方向顺序是否为：北、东北、东、东南、南、西南、西、西北
- 确保旋转角度正确
