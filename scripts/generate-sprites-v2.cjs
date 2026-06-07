#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');

/**
 * 高质量红警2风格精灵图生成器 v2
 * 更精致，更接近原版
 */

// 红警2风格调色板
const COLORS = {
  allied: {
    primary: [74, 127, 181],
    secondary: [46, 92, 138],
    highlight: [90, 159, 217],
    shadow: [30, 76, 122],
    accent: [135, 206, 235]
  },
  soviet: {
    primary: [139, 32, 32],
    secondary: [122, 21, 21],
    highlight: [165, 40, 40],
    shadow: [106, 16, 16],
    accent: [255, 215, 0]
  },
  common: {
    track: [26, 26, 26],
    trackLight: [42, 42, 42],
    gun: [26, 26, 26],
    skin: [232, 184, 150],
    boot: [42, 31, 26],
    pant: [139, 115, 85],
    pantSoviet: [107, 66, 38],
    glass: [135, 206, 235],
    helmet: [74, 103, 65],
    helmetSoviet: [58, 74, 42],
    shadow: [0, 0, 0, 100]
  }
};

// 精灵图配置
const SPRITE_SIZE = 64;
const DIRECTIONS = 8;
const FRAMES = 4;

// 创建画布
function createCanvas(width, height) {
  return Canvas.createCanvas(width, height);
}

// 颜色辅助函数
function rgba(c, alpha = 255) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function darken(c, amount) {
  return c.map(v => Math.max(0, v - amount));
}

function lighten(c, amount) {
  return c.map(v => Math.min(255, v + amount));
}

// 绘制像素矩形（坐标偏移为中心）
function drawRect(ctx, x, y, w, h, color, baseX = 0, baseY = 0) {
  ctx.fillStyle = rgba(color);
  ctx.fillRect(baseX + x, baseY + y, w, h);
}

// 绘制阴影
function drawShadow(ctx, baseX, baseY, radius, squish = 0.5) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + radius * squish, radius, radius * squish * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 生成盟军士兵
function generateAlliedSoldier() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      // 阴影
      drawShadow(ctx, 0, 0, 24);

      // 腿部动画
      const legAnim = Math.sin(frame * Math.PI/2) * 3;

      // 腿（左）
      drawRect(ctx, -10, 8+legAnim, 8, 14, COLORS.common.pant, 0, 0);
      // 腿（右）
      drawRect(ctx, 2, 8-legAnim, 8, 14, COLORS.common.pant, 0, 0);

      // 靴子
      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      // 身体
      drawRect(ctx, -12, -4, 24, 16, COLORS.allied.primary, 0, 0);
      // 身体阴影
      drawRect(ctx, -10, 2, 20, 6, COLORS.allied.secondary, 0, 0);
      // 身体高光
      drawRect(ctx, -10, -2, 20, 4, COLORS.allied.highlight, 0, 0);

      // 腰带
      drawRect(ctx, -12, 8, 24, 4, [74,55,40], 0, 0);

      // 头部
      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);

      // 头盔
      drawRect(ctx, -8, -16, 16, 6, COLORS.common.helmet, 0, 0);
      drawRect(ctx, -6, -18, 12, 4, COLORS.common.helmet, 0, 0);
      drawRect(ctx, -4, -16, 8, 2, lighten(COLORS.common.helmet,30), 0, 0);

      // 眼睛
      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);

      // 手臂和枪
      drawRect(ctx, 10, -2, 10, 8, COLORS.allied.primary, 0, 0);
      // 枪
      drawRect(ctx, 14, -0, 16, 4, COLORS.common.track, 0, 0);
      // 枪口
      drawRect(ctx, 28, -1, 4, 6, [20,20,20], 0, 0);

      // 盟军标志
      drawRect(ctx, -8, -2, 4, 4, COLORS.allied.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成苏军士兵
function generateSovietSoldier() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      drawShadow(ctx, 0, 0, 24);

      const legAnim = Math.sin(frame * Math.PI/2) * 3;

      drawRect(ctx, -10, 8+legAnim, 8, 14, COLORS.common.pantSoviet, 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, COLORS.common.pantSoviet, 0, 0);

      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      drawRect(ctx, -12, -4, 24, 16, COLORS.soviet.primary, 0, 0);
      drawRect(ctx, -10, 2, 20, 6, COLORS.soviet.secondary, 0, 0);
      drawRect(ctx, -10, -2, 20, 4, COLORS.soviet.highlight, 0, 0);

      drawRect(ctx, -12, 8, 24, 4, [74,55,40], 0, 0);

      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);

      drawRect(ctx, -8, -16, 16, 6, COLORS.common.helmetSoviet, 0, 0);
      drawRect(ctx, -6, -18, 12, 4, COLORS.common.helmetSoviet, 0, 0);
      drawRect(ctx, -4, -16, 8, 2, lighten(COLORS.common.helmetSoviet,25), 0, 0);

      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);

      drawRect(ctx, 10, -2, 10, 8, COLORS.soviet.primary, 0, 0);
      drawRect(ctx, 14, 0, 16, 4, COLORS.common.track, 0, 0);
      drawRect(ctx, 28, -1, 4, 6, [20,20,20], 0, 0);

      drawRect(ctx, -8, -2, 4, 4, COLORS.soviet.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成盟军坦克（灰熊）
function generateAlliedTank() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      drawShadow(ctx, 0, 0, 28);

      // 履带动画
      const trackOffset = frame * 3 % 8;

      // 左履带
      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      // 右履带
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      // 车身
      drawRect(ctx, -20, -16, 40, 32, COLORS.allied.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, COLORS.allied.secondary, 0, 0);
      drawRect(ctx, -16, -14, 32, 6, COLORS.allied.highlight, 0, 0);

      // 炮塔
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba(COLORS.allied.secondary);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba(COLORS.allied.highlight);
      ctx.fill();

      // 炮管
      drawRect(ctx, 8, -4, 22, 8, COLORS.common.gun, 0, 0);
      drawRect(ctx, 26, -5, 6, 10, [20,20,20], 0, 0);

      // 标志
      drawRect(ctx, -4, -3, 6, 6, COLORS.allied.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成苏军坦克（犀牛）
function generateSovietTank() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      drawShadow(ctx, 0, 0, 28);

      const trackOffset = frame * 3 % 8;

      // 左履带
      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      // 右履带
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      // 车身
      drawRect(ctx, -20, -16, 40, 32, COLORS.soviet.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, COLORS.soviet.secondary, 0, 0);
      drawRect(ctx, -16, -14, 32, 6, COLORS.soviet.highlight, 0, 0);

      // 炮塔（更大）
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = rgba(COLORS.soviet.secondary);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = rgba(COLORS.soviet.highlight);
      ctx.fill();

      // 炮管（更粗）
      drawRect(ctx, 6, -5, 26, 10, COLORS.common.gun, 0, 0);
      drawRect(ctx, 28, -6, 6, 12, [20,20,20], 0, 0);

      // 标志
      drawRect(ctx, -5, -4, 8, 8, COLORS.soviet.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成采矿车
function generateMiner(faction) {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;
  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      drawShadow(ctx, 0, 0, 30);

      const trackOffset = frame * 2 % 8;

      // 左履带
      drawRect(ctx, -30, -10, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -10; i < 18; i += 4) {
        drawRect(ctx, -29, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      // 右履带
      drawRect(ctx, 18, -10, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -10; i < 18; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      // 车身
      drawRect(ctx, -22, -18, 44, 38, colors.primary, 0, 0);
      drawRect(ctx, -20, -12, 40, 28, colors.secondary, 0, 0);
      drawRect(ctx, -20, -16, 40, 8, colors.highlight, 0, 0);

      // 货舱（矿）
      drawRect(ctx, -16, -14, 32, 20, [255, 179, 71], 0, 0);
      for (let i = 0; i < 4; i++) {
        const ox = Math.sin(frame + i) * 4;
        const oy = Math.cos(frame + i) * 4;
        drawRect(ctx, -12 + i * 8 + ox, -8 + oy, 4, 6, [255, 225, 100], 0, 0);
      }

      // 驾驶舱
      drawRect(ctx, -10, -20, 20, 8, colors.highlight, 0, 0);
      drawRect(ctx, -6, -18, 4, 4, COLORS.common.glass, 0, 0);
      drawRect(ctx, 2, -18, 4, 4, COLORS.common.glass, 0, 0);

      // 标志
      drawRect(ctx, -4, 0, 8, 8, colors.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成直升机
function generateHelicopter(faction) {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;
  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      // 浮动动画
      const floatOffset = Math.sin(frame * Math.PI/2) * 2;

      // 机身
      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 20, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 16, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      // 尾翼
      drawRect(ctx, -26, floatOffset - 4, 10, 8, colors.secondary, 0, 0);

      // 旋翼（动画）
      const rotorAngle = frame * Math.PI/2;
      ctx.strokeStyle = rgba([200,200,200], 180);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18 * Math.cos(rotorAngle), floatOffset - 12 * Math.sin(rotorAngle));
      ctx.lineTo(18 * Math.cos(rotorAngle), floatOffset + 12 * Math.sin(rotorAngle));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18 * Math.cos(rotorAngle + Math.PI/2), floatOffset - 12 * Math.sin(rotorAngle + Math.PI/2));
      ctx.lineTo(18 * Math.cos(rotorAngle + Math.PI/2), floatOffset + 12 * Math.sin(rotorAngle + Math.PI/2));
      ctx.stroke();

      // 机鼻
      drawRect(ctx, 18, floatOffset - 3, 12, 6, colors.secondary, 0, 0);

      // 驾驶舱
      drawRect(ctx, -6, floatOffset - 6, 12, 6, COLORS.common.glass, 0, 0);

      // 标志
      drawRect(ctx, -4, floatOffset - 2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成工程师
function generateEngineer(faction) {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;
  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const ox = frame * SPRITE_SIZE;
      const oy = dir * SPRITE_SIZE;
      const cx = ox + SPRITE_SIZE/2;
      const cy = oy + SPRITE_SIZE/2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngles[dir]);

      drawShadow(ctx, 0, 0, 24);

      const legAnim = Math.sin(frame * Math.PI/2) * 3;

      // 腿
      drawRect(ctx, -10, 8+legAnim, 8, 14, faction === 'allied' ? COLORS.common.pant : COLORS.common.pantSoviet, 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, faction === 'allied' ? COLORS.common.pant : COLORS.common.pantSoviet, 0, 0);

      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      // 身体（黄色工作服）
      drawRect(ctx, -12, -4, 24, 16, [255, 204, 0], 0, 0);
      drawRect(ctx, -10, 2, 20, 6, [204, 163, 0], 0, 0);

      // 工具
      drawRect(ctx, 12, -2, 8, 6, [139, 90, 43], 0, 0);
      drawRect(ctx, 18, -4, 4, 8, [100, 100, 100], 0, 0);

      // 头部
      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);

      // 安全帽
      drawRect(ctx, -8, -18, 16, 8, [255, 102, 0], 0, 0);
      drawRect(ctx, -6, -20, 12, 4, [255, 153, 51], 0, 0);

      // 眼睛
      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);

      // 腰带
      drawRect(ctx, -12, 8, 24, 4, [100,100,100], 0, 0);

      ctx.restore();
    }
  }

  return canvas;
}

// 生成建筑
function generateBuilding(type, faction) {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(64, 100, 45, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'command') {
    // 指挥中心
    drawRect(ctx, 10, 30, 108, 70, colors.primary);
    drawRect(ctx, 12, 32, 104, 66, colors.secondary);
    
    // 屋顶
    drawRect(ctx, 10, 30, 108, 12, colors.highlight);
    
    // 顶部塔
    drawRect(ctx, 40, 10, 48, 28, colors.secondary);
    drawRect(ctx, 42, 12, 44, 24, colors.highlight);
    
    // 窗户
    for (let y = 50; y < 90; y += 16) {
      for (let x = 22; x < 100; x += 16) {
        drawRect(ctx, x, y, 8, 8, COLORS.common.glass);
      }
    }
    
    // 天线
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 10);
    ctx.lineTo(64, 0);
    ctx.stroke();
    ctx.fillStyle = rgba(colors.accent);
    ctx.beginPath();
    ctx.arc(64, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  else if (type === 'barracks') {
    // 兵营
    drawRect(ctx, 10, 40, 108, 60, colors.primary);
    drawRect(ctx, 12, 42, 104, 56, colors.secondary);
    
    drawRect(ctx, 10, 40, 108, 10, colors.highlight);
    
    // 门
    drawRect(ctx, 46, 70, 36, 30, [107,66,38]);
    
    // 窗户
    drawRect(ctx, 20, 55, 10, 10, COLORS.common.glass);
    drawRect(ctx, 98, 55, 10, 10, COLORS.common.glass);
    
    // 旗帜
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(105, 40);
    ctx.lineTo(105, 20);
    ctx.stroke();
    ctx.fillStyle = rgba(colors.primary);
    ctx.fillRect(105, 20, 14, 10);
  }
  else if (type === 'refinery') {
    // 矿石精炼厂
    drawRect(ctx, 10, 45, 108, 55, colors.primary);
    drawRect(ctx, 12, 47, 104, 51, colors.secondary);
    
    drawRect(ctx, 10, 45, 108, 10, colors.highlight);
    
    // 矿仓
    drawRect(ctx, 25, 25, 78, 25, [255, 179, 71]);
    drawRect(ctx, 27, 27, 74, 21, [255, 225, 100]);
    
    // 矿石装饰
    for (let i = 0; i < 5; i++) {
      const ox = 30 + i * 14;
      drawRect(ctx, ox, 30, 6, 8, [255, 179, 71]);
    }
    
    // 卸料口
    drawRect(ctx, 40, 85, 48, 15, [100, 100, 100]);
    
    // 窗户
    drawRect(ctx, 18, 55, 8, 8, COLORS.common.glass);
    drawRect(ctx, 102, 55, 8, 8, COLORS.common.glass);
  }
  else if (type === 'warfactory') {
    // 战车工厂
    drawRect(ctx, 8, 35, 112, 65, colors.primary);
    drawRect(ctx, 10, 37, 108, 61, colors.secondary);
    
    drawRect(ctx, 8, 35, 112, 12, colors.highlight);
    
    // 大门
    drawRect(ctx, 30, 55, 68, 45, [100, 100, 100]);
    drawRect(ctx, 32, 57, 64, 41, [130, 130, 130]);
    
    // 大门轨道
    drawRect(ctx, 28, 60, 6, 35, [80, 80, 80]);
    drawRect(ctx, 94, 60, 6, 35, [80, 80, 80]);
    
    // 窗户
    drawRect(ctx, 15, 45, 10, 10, COLORS.common.glass);
    drawRect(ctx, 103, 45, 10, 10, COLORS.common.glass);
    
    // 顶部起重机
    ctx.strokeStyle = rgba(colors.primary);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 35);
    ctx.lineTo(64, 15);
    ctx.lineTo(85, 15);
    ctx.stroke();
  }

  return canvas;
}

// 保存文件
function saveCanvas(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`生成了: ${path.basename(filename)}`);
}

// 主函数
async function main() {
  console.log('🎨 正在生成高质量精灵图 v2.1...\n');

  const outDir = path.join(__dirname, '../public/assets/sprites');
  
  // 确保目录
  fs.mkdirSync(path.join(outDir, 'units'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'buildings'), { recursive: true });

  // 生成单位
  console.log('📦 生成单位精灵图...');
  saveCanvas(generateAlliedSoldier(), path.join(outDir, 'units/allied_soldier.png'));
  saveCanvas(generateSovietSoldier(), path.join(outDir, 'units/soviet_soldier.png'));
  saveCanvas(generateAlliedTank(), path.join(outDir, 'units/allied_tank.png'));
  saveCanvas(generateSovietTank(), path.join(outDir, 'units/soviet_tank.png'));
  saveCanvas(generateMiner('allied'), path.join(outDir, 'units/allied_miner.png'));
  saveCanvas(generateMiner('soviet'), path.join(outDir, 'units/soviet_miner.png'));
  saveCanvas(generateHelicopter('allied'), path.join(outDir, 'units/allied_helicopter.png'));
  saveCanvas(generateHelicopter('soviet'), path.join(outDir, 'units/soviet_helicopter.png'));
  saveCanvas(generateEngineer('allied'), path.join(outDir, 'units/allied_engineer.png'));
  saveCanvas(generateEngineer('soviet'), path.join(outDir, 'units/soviet_engineer.png'));

  // 生成建筑
  console.log('🏛️  生成建筑精灵图...');
  saveCanvas(generateBuilding('command', 'allied'), path.join(outDir, 'buildings/allied_command.png'));
  saveCanvas(generateBuilding('command', 'soviet'), path.join(outDir, 'buildings/soviet_command.png'));
  saveCanvas(generateBuilding('barracks', 'allied'), path.join(outDir, 'buildings/allied_barracks.png'));
  saveCanvas(generateBuilding('barracks', 'soviet'), path.join(outDir, 'buildings/soviet_barracks.png'));
  saveCanvas(generateBuilding('refinery', 'allied'), path.join(outDir, 'buildings/allied_refinery.png'));
  saveCanvas(generateBuilding('refinery', 'soviet'), path.join(outDir, 'buildings/soviet_refinery.png'));
  saveCanvas(generateBuilding('warfactory', 'allied'), path.join(outDir, 'buildings/allied_warfactory.png'));
  saveCanvas(generateBuilding('warfactory', 'soviet'), path.join(outDir, 'buildings/soviet_warfactory.png'));

  console.log('\n✅ 全部精灵图生成完成！');
  console.log('📍 文件位置: public/assets/sprites/');
  console.log('📋 新添加: 采矿车、直升机、工程师、精炼厂、战车工厂');
  console.log('🎮 请运行 npm run dev 查看效果');
}

main().catch(console.error);
