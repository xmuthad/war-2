const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

/**
 * 红警2 SHP 精灵图提取工具
 * SHP 格式是 Westwood 游戏使用的精灵图格式
 * 
 * 注意：需要红警2游戏文件才能提取
 * 这里提供一个模拟生成器，生成类似红警2风格的精灵图
 */

// 红警2风格颜色调色板
const RA2_PALETTE = {
  allied: {
    primary: [74, 127, 181],      // #4A7FB5
    secondary: [46, 92, 138],     // #2E5C8A
    highlight: [90, 143, 197],    // #5A8FC5
    shadow: [30, 76, 122],        // #1E4C7A
    accent: [135, 206, 235],      // #87CEEB
  },
  soviet: {
    primary: [139, 32, 32],       // #8B2020
    secondary: [122, 21, 21],     // #7A1515
    highlight: [155, 48, 48],     // #9B3030
    shadow: [106, 16, 16],        // #6A1010
    accent: [255, 215, 0],        // #FFD700
  },
  common: {
    track: [26, 26, 26],          // #1A1A1A
    trackLight: [42, 42, 42],     // #2A2A2A
    gun: [42, 42, 42],            // #2A2A2A
    gunLight: [58, 58, 58],       // #3A3A3A
    skin: [232, 184, 150],        // #E8B896
    boot: [42, 31, 26],           // #2A1F1A
    pant: [139, 115, 85],         // #8B7355
    pantSoviet: [107, 66, 38],    // #6B4226
    glass: [135, 206, 235],       // #87CEEB
    helmet: [74, 103, 65],        // #4A6741
    helmetSoviet: [58, 74, 42],   // #3A4A2A
  }
};

// 精灵图配置
const SPRITE_SIZE = 64;
const DIRECTIONS = 8;
const FRAMES = 4;

// 创建画布
function createSpriteCanvas(width, height) {
  const canvas = createCanvas(width, height);
  return canvas;
}

// 绘制像素矩形
function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.fillRect(x, y, w, h);
}

// 绘制像素圆
function drawCircle(ctx, x, y, r, color) {
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// 混合颜色
function blendColors(color1, color2, ratio) {
  return [
    Math.round(color1[0] * (1 - ratio) + color2[0] * ratio),
    Math.round(color1[1] * (1 - ratio) + color2[1] * ratio),
    Math.round(color1[2] * (1 - ratio) + color2[2] * ratio)
  ];
}

// 生成红警2风格的盟军步兵精灵图
function generateAlliedSoldier() {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = RA2_PALETTE.allied;
  const common = RA2_PALETTE.common;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    
    for (let frame = 0; frame < FRAMES; frame++) {
      const offsetX = frame * SPRITE_SIZE;
      const offsetY = dir * SPRITE_SIZE;
      const centerX = offsetX + SPRITE_SIZE / 2;
      const centerY = offsetY + SPRITE_SIZE / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const s = SPRITE_SIZE / 16;

      // 清除背景
      ctx.clearRect(-SPRITE_SIZE/2, -SPRITE_SIZE/2, SPRITE_SIZE, SPRITE_SIZE);

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 6*s, 5*s, 2*s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 腿部动画
      const legOffset = Math.sin((frame / FRAMES) * Math.PI * 2) * 1.5 * s;

      // 左腿
      drawRect(ctx, -3*s, 2*s + legOffset, 2.5*s, 4*s, common.pant);
      // 右腿
      drawRect(ctx, 0.5*s, 2*s - legOffset, 2.5*s, 4*s, common.pant);

      // 靴子
      drawRect(ctx, -3*s, 5*s + legOffset, 2.5*s, 1.5*s, common.boot);
      drawRect(ctx, 0.5*s, 5*s - legOffset, 2.5*s, 1.5*s, common.boot);

      // 身体 - 蓝色制服
      drawRect(ctx, -4*s, -3*s, 8*s, 6*s, colors.primary);

      // 身体细节 - 背心
      drawRect(ctx, -3*s, -2*s, 6*s, 4*s, colors.secondary);

      // 身体高光
      drawRect(ctx, -3*s, -2*s, 6*s, 1*s, colors.highlight);

      // 腰带
      drawRect(ctx, -4*s, 2*s, 8*s, 1*s, [74, 55, 40]);

      // 头部
      drawRect(ctx, -2.5*s, -7*s, 5*s, 5*s, common.skin);

      // 头盔
      drawRect(ctx, -3.5*s, -8*s, 7*s, 3*s, common.helmet);
      drawRect(ctx, -2.5*s, -9*s, 5*s, 2*s, common.helmet);

      // 头盔高光
      drawRect(ctx, -2*s, -8*s, 2*s, 1*s, blendColors(common.helmet, [255,255,255], 0.3));

      // 眼睛
      drawRect(ctx, -1.5*s, -5*s, 1*s, 1*s, [42, 31, 26]);
      drawRect(ctx, 0.5*s, -5*s, 1*s, 1*s, [42, 31, 26]);

      // 手臂
      drawRect(ctx, 3*s, -1*s, 2.5*s, 2*s, colors.primary);

      // M16步枪
      drawRect(ctx, 2*s, 0, 7*s, 1.5*s, common.gun);
      drawRect(ctx, 8*s, -0.5*s, 1.5*s, 2.5*s, [26, 26, 26]);

      // 弹匣
      drawRect(ctx, 4*s, 1*s, 2*s, 1*s, [51, 51, 51]);

      // 盟军标志
      drawRect(ctx, -3*s, -2*s, 1.5*s, 1.5*s, colors.accent);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成红警2风格的苏军步兵精灵图
function generateSovietSoldier() {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = RA2_PALETTE.soviet;
  const common = RA2_PALETTE.common;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    
    for (let frame = 0; frame < FRAMES; frame++) {
      const offsetX = frame * SPRITE_SIZE;
      const offsetY = dir * SPRITE_SIZE;
      const centerX = offsetX + SPRITE_SIZE / 2;
      const centerY = offsetY + SPRITE_SIZE / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const s = SPRITE_SIZE / 16;

      // 清除背景
      ctx.clearRect(-SPRITE_SIZE/2, -SPRITE_SIZE/2, SPRITE_SIZE, SPRITE_SIZE);

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 6*s, 5*s, 2*s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 腿部动画
      const legOffset = Math.sin((frame / FRAMES) * Math.PI * 2) * 1.5 * s;

      // 左腿 - 棕色裤子
      drawRect(ctx, -3*s, 2*s + legOffset, 2.5*s, 4*s, common.pantSoviet);
      // 右腿
      drawRect(ctx, 0.5*s, 2*s - legOffset, 2.5*s, 4*s, common.pantSoviet);

      // 靴子
      drawRect(ctx, -3*s, 5*s + legOffset, 2.5*s, 1.5*s, common.boot);
      drawRect(ctx, 0.5*s, 5*s - legOffset, 2.5*s, 1.5*s, common.boot);

      // 身体 - 红色制服
      drawRect(ctx, -4*s, -3*s, 8*s, 6*s, colors.primary);

      // 身体细节
      drawRect(ctx, -3*s, -2*s, 6*s, 4*s, colors.secondary);

      // 身体高光
      drawRect(ctx, -3*s, -2*s, 6*s, 1*s, colors.highlight);

      // 腰带
      drawRect(ctx, -4*s, 2*s, 8*s, 1*s, [74, 55, 40]);

      // 头部
      drawRect(ctx, -2.5*s, -7*s, 5*s, 5*s, common.skin);

      // 钢盔
      drawRect(ctx, -3.5*s, -8*s, 7*s, 3*s, common.helmetSoviet);
      drawRect(ctx, -2.5*s, -9*s, 5*s, 2*s, common.helmetSoviet);

      // 钢盔高光
      drawRect(ctx, -2*s, -8*s, 2*s, 1*s, blendColors(common.helmetSoviet, [255,255,255], 0.3));

      // 眼睛
      drawRect(ctx, -1.5*s, -5*s, 1*s, 1*s, [42, 31, 26]);
      drawRect(ctx, 0.5*s, -5*s, 1*s, 1*s, [42, 31, 26]);

      // 手臂
      drawRect(ctx, 3*s, -1*s, 2.5*s, 2*s, colors.primary);

      // AK-47步枪
      drawRect(ctx, 2*s, 0, 7*s, 1.5*s, common.gun);
      drawRect(ctx, 8*s, -0.5*s, 1.5*s, 2.5*s, [26, 26, 26]);

      // 木质枪托
      drawRect(ctx, 5*s, 1*s, 2*s, 1*s, [139, 69, 19]);

      // 苏联标志 - 红星
      drawRect(ctx, -3*s, -2*s, 1.5*s, 1.5*s, colors.accent);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成红警2风格的坦克精灵图
function generateTank(faction) {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? RA2_PALETTE.allied : RA2_PALETTE.soviet;
  const common = RA2_PALETTE.common;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    
    for (let frame = 0; frame < FRAMES; frame++) {
      const offsetX = frame * SPRITE_SIZE;
      const offsetY = dir * SPRITE_SIZE;
      const centerX = offsetX + SPRITE_SIZE / 2;
      const centerY = offsetY + SPRITE_SIZE / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const s = SPRITE_SIZE / 16;

      // 清除背景
      ctx.clearRect(-SPRITE_SIZE/2, -SPRITE_SIZE/2, SPRITE_SIZE, SPRITE_SIZE);

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 5*s, 6*s, 2.5*s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 履带动画
      const trackOffset = (frame % 2) * 1 * s;

      // 左履带
      drawRect(ctx, -6*s, -4*s, 2.5*s, 8*s, common.track);
      // 履带纹理
      for (let i = -3; i < 4; i++) {
        const y = (i*2*s + trackOffset) % (8*s) - 4*s;
        drawRect(ctx, -6*s, y, 2.5*s, 0.8*s, common.trackLight);
      }

      // 右履带
      drawRect(ctx, 3.5*s, -4*s, 2.5*s, 8*s, common.track);
      // 履带纹理
      for (let i = -3; i < 4; i++) {
        const y = (i*2*s + trackOffset) % (8*s) - 4*s;
        drawRect(ctx, 3.5*s, y, 2.5*s, 0.8*s, common.trackLight);
      }

      // 车身
      drawRect(ctx, -4*s, -3.5*s, 8*s, 7*s, colors.primary);

      // 车身细节
      drawRect(ctx, -3*s, -2.5*s, 6*s, 5*s, colors.secondary);

      // 车身高光
      drawRect(ctx, -3*s, -2.5*s, 6*s, 1*s, colors.highlight);

      // 炮塔底座
      drawCircle(ctx, 0, 0, 3*s, colors.primary);

      // 炮塔
      drawCircle(ctx, 0, 0, 2*s, colors.secondary);

      // 炮管
      drawRect(ctx, 1*s, -0.8*s, 6*s, 1.6*s, common.gun);

      // 炮口
      drawRect(ctx, 6.5*s, -1*s, 1.5*s, 2*s, [26, 26, 26]);

      // 标志
      drawRect(ctx, -2*s, -1*s, 1.5*s, 1.5*s, colors.accent);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成建筑精灵图
function generateBuilding(type, faction) {
  const canvas = createSpriteCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? RA2_PALETTE.allied : RA2_PALETTE.soviet;

  // 清除背景
  ctx.clearRect(0, 0, 128, 128);

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(64, 100, 50, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'command') {
    // 指挥中心 - 多层建筑
    // 主体
    drawRect(ctx, 15, 25, 98, 80, colors.primary);
    drawRect(ctx, 15, 25, 98, 80, colors.secondary);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgb(${colors.shadow[0]}, ${colors.shadow[1]}, ${colors.shadow[2]})`;
    ctx.strokeRect(15, 25, 98, 80);

    // 屋顶
    drawRect(ctx, 15, 25, 98, 15, colors.highlight);

    // 顶部指挥塔
    drawRect(ctx, 40, 5, 48, 25, colors.secondary);
    ctx.strokeRect(40, 5, 48, 25);

    // 天线
    ctx.strokeStyle = 'rgb(255, 215, 0)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 5);
    ctx.lineTo(64, 0);
    ctx.stroke();

    // 窗户
    ctx.fillStyle = 'rgb(135, 206, 235)';
    for (let x = 22; x < 110; x += 14) {
      for (let y = 45; y < 95; y += 14) {
        ctx.fillRect(x, y, 6, 6);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, 6, 6);
      }
    }

    // 门
    drawRect(ctx, 55, 85, 18, 20, [107, 66, 38]);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(55, 85, 18, 20);
  } else if (type === 'barracks') {
    // 兵营
    drawRect(ctx, 15, 35, 98, 70, colors.primary);
    ctx.strokeStyle = `rgb(${colors.shadow[0]}, ${colors.shadow[1]}, ${colors.shadow[2]})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 35, 98, 70);

    // 屋顶
    drawRect(ctx, 15, 35, 98, 12, colors.highlight);

    // 大门
    drawRect(ctx, 45, 65, 38, 40, [107, 66, 38]);
    ctx.strokeStyle = 'rgb(90, 53, 32)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(45, 65, 38, 40);

    // 窗户
    ctx.fillStyle = 'rgb(135, 206, 235)';
    ctx.fillRect(22, 50, 8, 8);
    ctx.fillRect(98, 50, 8, 8);

    // 旗帜
    ctx.strokeStyle = 'rgb(255, 215, 0)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(105, 35);
    ctx.lineTo(105, 15);
    ctx.stroke();
    ctx.fillStyle = faction === 'allied' ? 'rgb(74, 127, 181)' : 'rgb(255, 0, 0)';
    ctx.fillRect(105, 15, 12, 8);
  }

  return canvas;
}

// 保存画布
function saveCanvas(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Generated: ${filename}`);
}

// 主函数
function main() {
  const outputDir = path.join(__dirname, '../public/assets/sprites');

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating RA2-style sprite sheets...');

  // 生成单位精灵图
  const alliedSoldier = generateAlliedSoldier();
  saveCanvas(alliedSoldier, path.join(outputDir, 'units/allied_soldier.png'));

  const sovietSoldier = generateSovietSoldier();
  saveCanvas(sovietSoldier, path.join(outputDir, 'units/soviet_soldier.png'));

  const alliedTank = generateTank('allied');
  saveCanvas(alliedTank, path.join(outputDir, 'units/allied_tank.png'));

  const sovietTank = generateTank('soviet');
  saveCanvas(sovietTank, path.join(outputDir, 'units/soviet_tank.png'));

  // 生成建筑精灵图
  const alliedCommand = generateBuilding('command', 'allied');
  saveCanvas(alliedCommand, path.join(outputDir, 'buildings/allied_command.png'));

  const sovietCommand = generateBuilding('command', 'soviet');
  saveCanvas(sovietCommand, path.join(outputDir, 'buildings/soviet_command.png'));

  const alliedBarracks = generateBuilding('barracks', 'allied');
  saveCanvas(alliedBarracks, path.join(outputDir, 'buildings/allied_barracks.png'));

  const sovietBarracks = generateBuilding('barracks', 'soviet');
  saveCanvas(sovietBarracks, path.join(outputDir, 'buildings/soviet_barracks.png'));

  console.log('RA2-style sprite generation complete!');
  console.log('');
  console.log('注意：这些是模拟红警2风格的精灵图。');
  console.log('要使用真实的红警2精灵图，需要：');
  console.log('1. 拥有红警2游戏文件');
  console.log('2. 使用 XCC Mixer 或 OpenRA 工具提取 SHP 文件');
  console.log('3. 将提取的精灵图放入 public/assets/sprites/ 目录');
}

main();
