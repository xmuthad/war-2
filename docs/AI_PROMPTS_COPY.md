# 🎯 AI精灵图生成 - 快速复制提示词

## 使用步骤

1. 打开 https://chat.openai.com/ 或 https://www.bing.com/create
2. 复制下面的提示词
3. 生成图片
4. 下载保存
5. 按文件名保存到对应目录

---

## 👤 单位提示词

### 美国大兵
```
US army infantry soldier, pixel art, 64x64 pixels, top-down view, standing at attention, wearing blue US army uniform, green combat helmet, holding M16 rifle, military boots, belt with ammo pouches, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 动员兵
```
Soviet Red Army infantry soldier, pixel art, 64x64 pixels, top-down view, standing at attention, wearing dark red military uniform, ushanka fur hat, holding AK-47 rifle, military boots, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 灰熊坦克
```
US NATO light battle tank, pixel art, 64x64 pixels, top-down view, blue military paint scheme, dark grey tank treads, rotating turret with medium cannon, heavy armor plating, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 犀牛坦克
```
Soviet heavy battle tank, pixel art, 64x64 pixels, top-down view, dark red military paint scheme, oversized turret, thick armor, dark grey tank treads, large caliber cannon, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 光棱坦克
```
futuristic Allied Prism Tank, pixel art, 64x64 pixels, top-down view, sleek blue high-tech armor, large prism crystal on turret emitting blue light, energy weapon system, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 天启坦克
```
massive Soviet Apocalypse super heavy tank, pixel art, 64x64 pixels, top-down view, dark red battle armor, twin large caliber cannons, missile launcher pod on top, enormous tank treads, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 磁能坦克
```
Soviet Tesla Tank with electric Tesla coil turret, pixel art, 64x64 pixels, top-down view, dark red armored chassis, Tesla coil generating electric arcs and blue lightning, electrical discharge effects, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 夜鹰直升机
```
US Allied Nighthawk attack helicopter, pixel art, 64x64 pixels, top-down view, blue military aircraft, single main rotor, tail rotor, armed with missiles, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 雌鹿直升机
```
Soviet Mi-24 Hind attack helicopter, pixel art, 64x64 pixels, top-down view, dark red military aircraft, side-mounted cannons, missile pods, Fenrir rotor system, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 幻影坦克
```
Allied Mirage Tank with holographic camouflage, pixel art, 64x64 pixels, top-down view, blue stealth armor, visible holographic distortion effect, partially transparent camouflage field, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 采矿车
```
Allied mobile ore refinery unit, pixel art, 64x64 pixels, top-down view, yellow and blue civilian vehicle, large ore processing container on back, mining drill mechanism, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 武装采矿车
```
Soviet Harvester ore collection unit, pixel art, 64x64 pixels, top-down view, red and yellow armored harvester, ore container, mining equipment, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 谭雅
```
female commando Tanya in black combat suit, pixel art, 64x64 pixels, top-down view, blonde hair, dual pistols, action stance, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 工程师
```
military engineer in tan uniform, pixel art, 64x64 pixels, top-down view, yellow safety vest, hard hat, carrying wrench tool, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

---

## 🏢 建筑提示词

### 盟军建造厂
```
Allied faction construction yard building, pixel art, 128x128 pixels, top-down isometric view, blue and grey industrial factory with large crane, military construction facility, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 苏军建造厂
```
Soviet faction construction yard building, pixel art, 128x128 pixels, top-down isometric view, red fortress-like factory with towers, industrial construction facility, Soviet architecture, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 盟军兵营
```
Allied faction barracks building, pixel art, 128x128 pixels, top-down isometric view, blue military barracks with flag pole, soldier training facility, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

### 苏军兵营
```
Soviet faction barracks building, pixel art, 128x128 pixels, top-down isometric view, red military barracks with Soviet star emblem, soldier training facility, Red Alert 2 style, retro 1990s RTS game graphics, transparent background, sharp pixels, no anti-aliasing
```

---

## 📁 保存位置

```
public/assets/sprites/units/
  allied_soldier.png       <- 美国大兵
  soviet_soldier.png       <- 动员兵
  allied_tank.png          <- 灰熊坦克
  soviet_tank.png          <- 犀牛坦克
  allied_prism.png         <- 光棱坦克
  soviet_apocalypse.png    <- 天启坦克
  soviet_tesla.png         <- 磁能坦克
  allied_nighthawk.png     <- 夜鹰直升机
  soviet_hind.png          <- 雌鹿直升机
  allied_mirage.png        <- 幻影坦克
  allied_miner.png         <- 采矿车
  soviet_harvester.png     <- 武装采矿车
  tanya.png                <- 谭雅
  engineer.png             <- 工程师

public/assets/sprites/buildings/
  allied_command.png       <- 盟军建造厂
  soviet_command.png       <- 苏军建造厂
  allied_barracks.png      <- 盟军兵营
  soviet_barracks.png      <- 苏军兵营
```

---

## 🎬 如何生成动画

分别生成4帧，然后拼接：

```
帧0: [单位], walking animation frame 1, right foot forward
帧1: [单位], walking animation frame 2, mid-stride
帧2: [单位], walking animation frame 3, left foot forward
帧3: [单位], walking animation frame 4, returning to start
```

---

## 💡 Pro提示

1. **免费工具**: 使用 Bing Image Creator 完全免费
2. **一次多张**: 一次生成多个变体，选择最好的
3. **调整提示词**: 如果效果不好，添加或删除细节
4. **保持一致**: 尝试为同一阵营的单位保持相似风格
5. **测试**: 生成后立即放入游戏测试
