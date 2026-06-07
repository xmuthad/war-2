const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 精灵图配置
const SPRITE_SIZE = 64;
const DIRECTIONS = 8; // 8个方向
const FRAMES = 4; // 每个方向4帧动画

// 颜色定义 - 红警2风格
const COLORS = {
  allied: {
    primary: '#4A7FB5',
    secondary: '#2E5C8A',
    highlight: '#5A8FC5',
    shadow: '#1E4C7A',
    accent: '#87CEEB'
  },
  soviet: {
    primary: '#8B2020',
    secondary: '#7A1515',
    highlight: '#9B3030',
    shadow: '#6A1010',
    accent: '#FFD700'
  },
  common: {
    track: '#1A1A1A',
    trackLight: '#2A2A2A',
    gun: '#2A2A2A',
    gunLight: '#3A3A3A',
    skin: '#E8B896',
    boot: '#2A1F1A',
    pant: '#8B7355',
    glass: '#87CEEB'
  }
};

// 创建画布
function createSpriteCanvas(width, height) {
  const canvas = createCanvas(width, height);
  return canvas;
}

// 绘制像素矩形
function drawPixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// 绘制像素圆
function drawPixelCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// 生成盟军步兵精灵图
function generateAlliedSoldierSprite() {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    const row = dir;

    for (let frame = 0; frame < FRAMES; frame++) {
      const col = frame;
      const offsetX = col * SPRITE_SIZE;
      const offsetY = row * SPRITE_SIZE;
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
      ctx.fillStyle = COLORS.common.pant;
      ctx.fillRect(-3*s, 2*s + legOffset, 2.5*s, 4*s);
      // 右腿
      ctx.fillRect(0.5*s, 2*s - legOffset, 2.5*s, 4*s);

      // 靴子
      ctx.fillStyle = COLORS.common.boot;
      ctx.fillRect(-3*s, 5*s + legOffset, 2.5*s, 1.5*s);
      ctx.fillRect(0.5*s, 5*s - legOffset, 2.5*s, 1.5*s);

      // 身体 - 蓝色制服
      ctx.fillStyle = COLORS.allied.primary;
      ctx.fillRect(-4*s, -3*s, 8*s, 6*s);

      // 身体细节
      ctx.fillStyle = COLORS.allied.secondary;
      ctx.fillRect(-3*s, -2*s, 6*s, 4*s);

      // 腰带
      ctx.fillStyle = '#4A3728';
      ctx.fillRect(-4*s, 2*s, 8*s, 1*s);

      // 头部
      ctx.fillStyle = COLORS.common.skin;
      ctx.fillRect(-2.5*s, -7*s, 5*s, 5*s);

      // 头盔
      ctx.fillStyle = '#4A6741';
      ctx.fillRect(-3.5*s, -8*s, 7*s, 3*s);
      ctx.fillRect(-2.5*s, -9*s, 5*s, 2*s);

      // 头盔高光
      ctx.fillStyle = '#5A7751';
      ctx.fillRect(-2*s, -8*s, 2*s, 1*s);

      // 眼睛
      ctx.fillStyle = '#2A1F1A';
      ctx.fillRect(-1.5*s, -5*s, 1*s, 1*s);
      ctx.fillRect(0.5*s, -5*s, 1*s, 1*s);

      // 手臂
      ctx.fillStyle = COLORS.allied.primary;
      ctx.fillRect(3*s, -1*s, 2.5*s, 2*s);

      // M16步枪
      ctx.fillStyle = COLORS.common.gun;
      ctx.fillRect(2*s, 0, 7*s, 1.5*s);
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(8*s, -0.5*s, 1.5*s, 2.5*s);

      // 弹匣
      ctx.fillStyle = '#333';
      ctx.fillRect(4*s, 1*s, 2*s, 1*s);

      // 盟军标志
      ctx.fillStyle = COLORS.allied.accent;
      ctx.fillRect(-3*s, -2*s, 1.5*s, 1.5*s);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成苏军步兵精灵图
function generateSovietSoldierSprite() {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    const row = dir;

    for (let frame = 0; frame < FRAMES; frame++) {
      const col = frame;
      const offsetX = col * SPRITE_SIZE;
      const offsetY = row * SPRITE_SIZE;
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
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(-3*s, 2*s + legOffset, 2.5*s, 4*s);
      // 右腿
      ctx.fillRect(0.5*s, 2*s - legOffset, 2.5*s, 4*s);

      // 靴子
      ctx.fillStyle = COLORS.common.boot;
      ctx.fillRect(-3*s, 5*s + legOffset, 2.5*s, 1.5*s);
      ctx.fillRect(0.5*s, 5*s - legOffset, 2.5*s, 1.5*s);

      // 身体 - 红色制服
      ctx.fillStyle = COLORS.soviet.primary;
      ctx.fillRect(-4*s, -3*s, 8*s, 6*s);

      // 身体细节
      ctx.fillStyle = COLORS.soviet.secondary;
      ctx.fillRect(-3*s, -2*s, 6*s, 4*s);

      // 腰带
      ctx.fillStyle = '#4A3728';
      ctx.fillRect(-4*s, 2*s, 8*s, 1*s);

      // 头部
      ctx.fillStyle = COLORS.common.skin;
      ctx.fillRect(-2.5*s, -7*s, 5*s, 5*s);

      // 钢盔
      ctx.fillStyle = '#3A4A2A';
      ctx.fillRect(-3.5*s, -8*s, 7*s, 3*s);
      ctx.fillRect(-2.5*s, -9*s, 5*s, 2*s);

      // 钢盔高光
      ctx.fillStyle = '#4A5A3A';
      ctx.fillRect(-2*s, -8*s, 2*s, 1*s);

      // 眼睛
      ctx.fillStyle = '#2A1F1A';
      ctx.fillRect(-1.5*s, -5*s, 1*s, 1*s);
      ctx.fillRect(0.5*s, -5*s, 1*s, 1*s);

      // 手臂
      ctx.fillStyle = COLORS.soviet.primary;
      ctx.fillRect(3*s, -1*s, 2.5*s, 2*s);

      // AK-47步枪
      ctx.fillStyle = COLORS.common.gun;
      ctx.fillRect(2*s, 0, 7*s, 1.5*s);
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(8*s, -0.5*s, 1.5*s, 2.5*s);

      // 木质枪托
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(5*s, 1*s, 2*s, 1*s);

      // 苏联标志 - 红星
      ctx.fillStyle = COLORS.soviet.accent;
      ctx.fillRect(-3*s, -2*s, 1.5*s, 1.5*s);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成坦克精灵图
function generateTankSprite(faction) {
  const canvas = createSpriteCanvas(SPRITE_SIZE * FRAMES, SPRITE_SIZE * DIRECTIONS);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const angle = (dir / DIRECTIONS) * Math.PI * 2;
    const row = dir;

    for (let frame = 0; frame < FRAMES; frame++) {
      const col = frame;
      const offsetX = col * SPRITE_SIZE;
      const offsetY = row * SPRITE_SIZE;
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
      ctx.fillStyle = COLORS.common.track;
      ctx.fillRect(-6*s, -4*s, 2.5*s, 8*s);
      // 履带纹理
      ctx.fillStyle = COLORS.common.trackLight;
      for (let i = -3; i < 4; i++) {
        ctx.fillRect(-6*s, (i*2*s + trackOffset) % (8*s) - 4*s, 2.5*s, 0.8*s);
      }

      // 右履带
      ctx.fillStyle = COLORS.common.track;
      ctx.fillRect(3.5*s, -4*s, 2.5*s, 8*s);
      // 履带纹理
      ctx.fillStyle = COLORS.common.trackLight;
      for (let i = -3; i < 4; i++) {
        ctx.fillRect(3.5*s, (i*2*s + trackOffset) % (8*s) - 4*s, 2.5*s, 0.8*s);
      }

      // 车身
      ctx.fillStyle = colors.primary;
      ctx.fillRect(-4*s, -3.5*s, 8*s, 7*s);

      // 车身细节
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(-3*s, -2.5*s, 6*s, 5*s);

      // 车身高光
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(-3*s, -2.5*s, 6*s, 1*s);

      // 炮塔底座
      ctx.fillStyle = colors.primary;
      drawPixelCircle(ctx, 0, 0, 3*s, colors.primary);

      // 炮塔
      drawPixelCircle(ctx, 0, 0, 2*s, colors.secondary);

      // 炮管
      ctx.fillStyle = COLORS.common.gun;
      ctx.fillRect(1*s, -0.8*s, 6*s, 1.6*s);

      // 炮口
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(6.5*s, -1*s, 1.5*s, 2*s);

      // 标志
      ctx.fillStyle = faction === 'allied' ? colors.accent : colors.accent;
      ctx.fillRect(-2*s, -1*s, 1.5*s, 1.5*s);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成建筑精灵图
function generateBuildingSprite(type, faction) {
  const canvas = createSpriteCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;

  // 清除背景
  ctx.clearRect(0, 0, 128, 128);

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(64, 100, 50, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'command') {
    // 指挥中心
    ctx.fillStyle = colors.primary;
    ctx.fillRect(20, 30, 88, 70);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 30, 88, 70);

    // 屋顶
    ctx.fillStyle = colors.highlight;
    ctx.fillRect(20, 30, 88, 15);

    // 顶部结构
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(45, 10, 38, 25);
    ctx.strokeRect(45, 10, 38, 25);

    // 天线
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 10);
    ctx.lineTo(64, 0);
    ctx.stroke();

    // 窗户
    ctx.fillStyle = '#87CEEB';
    for (let x = 28; x < 100; x += 12) {
      for (let y = 50; y < 90; y += 12) {
        ctx.fillRect(x, y, 6, 6);
      }
    }
  } else if (type === 'barracks') {
    // 兵营
    ctx.fillStyle = colors.primary;
    ctx.fillRect(20, 40, 88, 60);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 40, 88, 60);

    // 屋顶
    ctx.fillStyle = colors.highlight;
    ctx.fillRect(20, 40, 88, 12);

    // 大门
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(45, 70, 38, 30);
    ctx.strokeStyle = '#5A3520';
    ctx.strokeRect(45, 70, 38, 30);

    // 旗帜
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 40);
    ctx.lineTo(100, 20);
    ctx.stroke();
    ctx.fillStyle = faction === 'allied' ? '#4A90E2' : '#FF0000';
    ctx.fillRect(100, 20, 12, 8);
  }

  return canvas;
}

// 保存画布为PNG
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

  console.log('Generating sprite sheets...');

  // 生成单位精灵图
  const alliedSoldier = generateAlliedSoldierSprite();
  saveCanvas(alliedSoldier, path.join(outputDir, 'units/allied_soldier.png'));

  const sovietSoldier = generateSovietSoldierSprite();
  saveCanvas(sovietSoldier, path.join(outputDir, 'units/soviet_soldier.png'));

  const alliedTank = generateTankSprite('allied');
  saveCanvas(alliedTank, path.join(outputDir, 'units/allied_tank.png'));

  const sovietTank = generateTankSprite('soviet');
  saveCanvas(sovietTank, path.join(outputDir, 'units/soviet_tank.png'));

  // 生成建筑精灵图
  const alliedCommand = generateBuildingSprite('command', 'allied');
  saveCanvas(alliedCommand, path.join(outputDir, 'buildings/allied_command.png'));

  const sovietCommand = generateBuildingSprite('command', 'soviet');
  saveCanvas(sovietCommand, path.join(outputDir, 'buildings/soviet_command.png'));

  const alliedBarracks = generateBuildingSprite('barracks', 'allied');
  saveCanvas(alliedBarracks, path.join(outputDir, 'buildings/allied_barracks.png'));

  const sovietBarracks = generateBuildingSprite('barracks', 'soviet');
  saveCanvas(sovietBarracks, path.join(outputDir, 'buildings/soviet_barracks.png'));

  console.log('Sprite generation complete!');
}

main();
