#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');

/**
 * 完整的红警2风格精灵图生成器
 * 支持所有单位和建筑类型，包含建造动画和特效
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
  // 阵营特定颜色
  usa: {
    primary: [0, 100, 180],
    secondary: [0, 80, 150],
    highlight: [50, 150, 220],
    accent: [255, 255, 255]
  },
  britain: {
    primary: [200, 50, 50],
    secondary: [170, 30, 30],
    highlight: [220, 80, 80],
    accent: [100, 149, 237]
  },
  germany: {
    primary: [90, 110, 80],
    secondary: [70, 90, 60],
    highlight: [120, 140, 100],
    accent: [200, 200, 100]
  },
  france: {
    primary: [50, 80, 150],
    secondary: [30, 60, 130],
    highlight: [80, 110, 180],
    accent: [220, 220, 220]
  },
  korea: {
    primary: [60, 60, 80],
    secondary: [40, 40, 60],
    highlight: [100, 100, 120],
    accent: [255, 100, 100]
  },
  soviet_generic: {
    primary: [139, 32, 32],
    secondary: [122, 21, 21],
    highlight: [165, 40, 40],
    accent: [255, 215, 0]
  },
  cuba: {
    primary: [100, 50, 30],
    secondary: [80, 30, 20],
    highlight: [140, 80, 50],
    accent: [255, 180, 0]
  },
  libya: {
    primary: [120, 80, 40],
    secondary: [100, 60, 20],
    highlight: [160, 120, 70],
    accent: [255, 220, 100]
  },
  iraq: {
    primary: [80, 80, 50],
    secondary: [60, 60, 30],
    highlight: [120, 120, 80],
    accent: [255, 100, 50]
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
    shadow: [0, 0, 0, 100],
    gold: [255, 179, 71],
    silver: [192, 192, 192],
    tesla: [100, 200, 255],
    explosion: [255, 150, 50],
    smoke: [100, 100, 100],
    muzzle: [255, 200, 100]
  }
};

// 精灵图配置
const SPRITE_SIZE = 64;
const DIRECTIONS = 8;
const FRAMES = 4;
const BUILD_FRAMES = 8;

function createCanvas(width, height) {
  return Canvas.createCanvas(width, height);
}

function rgba(c, alpha = 255) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function lighten(c, amount) {
  return c.map(v => Math.min(255, v + amount));
}

function darken(c, amount) {
  return c.map(v => Math.max(0, v - amount));
}

function drawRect(ctx, x, y, w, h, color, baseX = 0, baseY = 0) {
  ctx.fillStyle = rgba(color);
  ctx.fillRect(baseX + x, baseY + y, w, h);
}

const SHADOW_ALPHA = 0.3;
const SHADOW_SQUISH = 0.5;
const SHADOW_RADIUS_RATIO = 0.6;

function drawShadow(ctx, baseX, baseY, radius, squish = SHADOW_SQUISH) {
  ctx.fillStyle = `rgba(0,0,0,${SHADOW_ALPHA})`;
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + radius * squish, radius, radius * SHADOW_RADIUS_RATIO, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(frame, size = 64) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const progress = frame / (FRAMES - 1);
  const radius = size * 0.4 * (0.5 + progress * 0.5);
  const innerRadius = radius * 0.3;

  // 外焰
  const gradient = ctx.createRadialGradient(size/2, size/2, innerRadius, size/2, size/2, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
  gradient.addColorStop(0.3, rgba(COLORS.common.explosion, 0.8));
  gradient.addColorStop(0.6, rgba([200, 50, 0], 0.6));
  gradient.addColorStop(1, 'rgba(100, 20, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, radius, 0, Math.PI * 2);
  ctx.fill();

  // 碎片
  ctx.fillStyle = rgba([255, 200, 100], 0.8);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + frame * 0.3;
    const dist = radius * 0.7 * (0.5 + Math.random() * 0.5);
    const x = size/2 + Math.cos(angle) * dist;
    const y = size/2 + Math.sin(angle) * dist;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function drawSmoke(frame, size = 32) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const progress = frame / (FRAMES - 1);
  const radius = size * 0.3 * (0.5 + progress * 0.5);
  const alpha = 0.6 * (1 - progress);

  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, radius);
  gradient.addColorStop(0, `rgba(150, 150, 150, ${alpha})`);
  gradient.addColorStop(1, `rgba(80, 80, 80, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, radius, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function drawMuzzleFlash(frame, size = 32) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (frame === 0) return canvas;

  const intensity = Math.abs(Math.sin(frame * Math.PI / 2));
  const radius = size * 0.4 * intensity;

  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, radius);
  gradient.addColorStop(0, `rgba(255, 255, 200, ${intensity})`);
  gradient.addColorStop(0.5, rgba(COLORS.common.muzzle, intensity * 0.8));
  gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, radius, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

// ============ 单位精灵图生成 ============

function generateSoldier(faction) {
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

      const pantColor = faction === 'allied' ? COLORS.common.pant : COLORS.common.pantSoviet;
      const helmetColor = faction === 'allied' ? COLORS.common.helmet : COLORS.common.helmetSoviet;

      drawRect(ctx, -10, 8+legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      drawRect(ctx, -12, -4, 24, 16, colors.primary, 0, 0);
      drawRect(ctx, -10, 2, 20, 6, colors.secondary, 0, 0);
      drawRect(ctx, -10, -2, 20, 4, colors.highlight, 0, 0);
      drawRect(ctx, -12, 8, 24, 4, [74,55,40], 0, 0);

      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -8, -16, 16, 6, helmetColor, 0, 0);
      drawRect(ctx, -6, -18, 12, 4, helmetColor, 0, 0);
      drawRect(ctx, -4, -16, 8, 2, lighten(helmetColor,30), 0, 0);

      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);

      drawRect(ctx, 10, -2, 10, 8, colors.primary, 0, 0);
      drawRect(ctx, 14, -0, 16, 4, COLORS.common.gun, 0, 0);
      drawRect(ctx, 28, -1, 4, 6, [20,20,20], 0, 0);

      drawRect(ctx, -8, -2, 4, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateTank(faction) {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;
  const dirAngles = [ -Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, -Math.PI*3/4 ];
  const isSoviet = faction === 'soviet';

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

      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      const turretSize = isSoviet ? 16 : 14;
      const gunLength = isSoviet ? 26 : 22;
      const gunWidth = isSoviet ? 10 : 8;

      drawRect(ctx, -20, -16, 40, 32, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);
      drawRect(ctx, -16, -14, 32, 6, colors.highlight, 0, 0);

      ctx.beginPath();
      ctx.arc(0, 0, turretSize, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, turretSize - 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      drawRect(ctx, 8 - (isSoviet ? 2 : 0), -gunWidth/2, gunLength, gunWidth, COLORS.common.gun, 0, 0);
      drawRect(ctx, 26 + (isSoviet ? 2 : 0), -(gunWidth+2)/2, 6, gunWidth+2, [20,20,20], 0, 0);

      drawRect(ctx, -4 - (isSoviet ? 1 : 0), -3 - (isSoviet ? 1 : 0), 6 + (isSoviet ? 2 : 0), 6 + (isSoviet ? 2 : 0), colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

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

      const pantColor = faction === 'allied' ? COLORS.common.pant : COLORS.common.pantSoviet;
      drawRect(ctx, -10, 8+legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      drawRect(ctx, -12, -4, 24, 16, [255, 204, 0], 0, 0);
      drawRect(ctx, -10, 2, 20, 6, [204, 163, 0], 0, 0);

      drawRect(ctx, 12, -2, 8, 6, [139, 90, 43], 0, 0);
      drawRect(ctx, 18, -4, 4, 8, [100, 100, 100], 0, 0);

      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -8, -18, 16, 8, [255, 102, 0], 0, 0);
      drawRect(ctx, -6, -20, 12, 4, [255, 153, 51], 0, 0);

      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, -12, 8, 24, 4, [100,100,100], 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

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

      drawRect(ctx, -30, -10, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -10; i < 18; i += 4) {
        drawRect(ctx, -29, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -10, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -10; i < 18; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -22, -18, 44, 38, colors.primary, 0, 0);
      drawRect(ctx, -20, -12, 40, 28, colors.secondary, 0, 0);
      drawRect(ctx, -20, -16, 40, 8, colors.highlight, 0, 0);

      drawRect(ctx, -16, -14, 32, 20, [255, 179, 71], 0, 0);
      for (let i = 0; i < 4; i++) {
        const ox = Math.sin(frame + i) * 4;
        const oy = Math.cos(frame + i) * 4;
        drawRect(ctx, -12 + i * 8 + ox, -8 + oy, 4, 6, [255, 225, 100], 0, 0);
      }

      drawRect(ctx, -10, -20, 20, 8, colors.highlight, 0, 0);
      drawRect(ctx, -6, -18, 4, 4, COLORS.common.glass, 0, 0);
      drawRect(ctx, 2, -18, 4, 4, COLORS.common.glass, 0, 0);
      drawRect(ctx, -4, 0, 8, 8, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

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

      const floatOffset = Math.sin(frame * Math.PI/2) * 2;

      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 20, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 16, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      drawRect(ctx, -26, floatOffset - 4, 10, 8, colors.secondary, 0, 0);

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

      drawRect(ctx, 18, floatOffset - 3, 12, 6, colors.secondary, 0, 0);
      drawRect(ctx, -6, floatOffset - 6, 12, 6, COLORS.common.glass, 0, 0);
      drawRect(ctx, -4, floatOffset - 2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateRocketSoldier(faction) {
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

      const pantColor = faction === 'allied' ? COLORS.common.pant : COLORS.common.pantSoviet;
      drawRect(ctx, -10, 8+legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, pantColor, 0, 0);
      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      drawRect(ctx, -12, -4, 24, 16, colors.primary, 0, 0);
      drawRect(ctx, -10, 2, 20, 6, colors.secondary, 0, 0);
      drawRect(ctx, -10, -2, 20, 4, colors.highlight, 0, 0);
      drawRect(ctx, -12, 8, 24, 4, [74,55,40], 0, 0);

      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -8, -16, 16, 6, colors.secondary, 0, 0);
      drawRect(ctx, -6, -18, 12, 4, colors.highlight, 0, 0);

      drawRect(ctx, -4, -10, 3, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 3, 2, [40,30,20], 0, 0);

      // 火箭发射器
      drawRect(ctx, 10, -8, 6, 18, [100, 100, 100], 0, 0);
      drawRect(ctx, 12, -12, 2, 6, [255, 100, 50], 0, 0);

      drawRect(ctx, -8, -2, 4, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateSniper(faction) {
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
      const legAnim = Math.sin(frame * Math.PI/2) * 2;

      drawRect(ctx, -10, 8+legAnim, 8, 14, [50, 60, 50], 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, [50, 60, 50], 0, 0);
      drawRect(ctx, -10, 20+legAnim, 8, 6, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, COLORS.common.boot, 0, 0);

      drawRect(ctx, -12, -4, 24, 16, [60, 70, 60], 0, 0);
      drawRect(ctx, -10, 2, 20, 6, [40, 50, 40], 0, 0);
      drawRect(ctx, -12, 8, 24, 4, [30, 40, 30], 0, 0);

      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -8, -18, 16, 8, [40, 50, 40], 0, 0);
      drawRect(ctx, -5, -20, 10, 4, [50, 60, 50], 0, 0);

      drawRect(ctx, -4, -10, 2, 2, [40,30,20], 0, 0);
      drawRect(ctx, 2, -10, 2, 2, [40,30,20], 0, 0);

      // 狙击枪
      drawRect(ctx, 10, -2, 22, 4, COLORS.common.gun, 0, 0);
      drawRect(ctx, 30, -3, 8, 6, [80, 80, 80], 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateSpy(faction) {
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
      const legAnim = Math.sin(frame * Math.PI/2) * 2;

      // 间谍穿深色西装
      drawRect(ctx, -10, 8+legAnim, 8, 14, [30, 30, 40], 0, 0);
      drawRect(ctx, 2, 8-legAnim, 8, 14, [30, 30, 40], 0, 0);
      drawRect(ctx, -10, 20+legAnim, 8, 6, [20, 20, 25], 0, 0);
      drawRect(ctx, 2, 20-legAnim, 8, 6, [20, 20, 25], 0, 0);

      // 西装外套
      drawRect(ctx, -12, -4, 24, 16, [25, 25, 35], 0, 0);
      drawRect(ctx, -2, -2, 4, 14, [200, 200, 200], 0, 0); // 白衬衫领口
      drawRect(ctx, -12, 8, 24, 4, [20, 20, 30], 0, 0);

      // 头部
      drawRect(ctx, -6, -14, 12, 12, COLORS.common.skin, 0, 0);
      // 墨镜
      drawRect(ctx, -6, -10, 12, 4, [10, 10, 10], 0, 0);
      // 头发
      drawRect(ctx, -7, -18, 14, 6, [20, 20, 20], 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateTanya() {
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

      drawRect(ctx, -8, 8+legAnim, 6, 14, [100, 100, 100], 0, 0);
      drawRect(ctx, 2, 8-legAnim, 6, 14, [100, 100, 100], 0, 0);
      drawRect(ctx, -8, 20+legAnim, 6, 6, [60, 60, 60], 0, 0);
      drawRect(ctx, 2, 20-legAnim, 6, 6, [60, 60, 60], 0, 0);

      drawRect(ctx, -10, -4, 20, 16, [255, 0, 0], 0, 0);
      drawRect(ctx, -8, 2, 16, 6, [200, 0, 0], 0, 0);
      drawRect(ctx, -10, 8, 20, 4, [150, 0, 0], 0, 0);

      drawRect(ctx, -5, -14, 10, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -6, -18, 12, 6, [200, 180, 160], 0, 0);
      drawRect(ctx, -4, -20, 8, 4, [220, 200, 180], 0, 0);

      drawRect(ctx, -3, -10, 2, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -10, 2, 2, [40,30,20], 0, 0);

      // 双枪
      drawRect(ctx, 8, -4, 8, 4, COLORS.common.gun, 0, 0);
      drawRect(ctx, 8, 2, 8, 4, COLORS.common.gun, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateIFV(faction) {
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
      const trackOffset = frame * 3 % 8;

      drawRect(ctx, -22, -10, 8, 22, COLORS.common.track, 0, 0);
      for (let i = -8; i < 10; i += 4) {
        drawRect(ctx, -21, i + trackOffset % 4 - 4, 6, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 14, -10, 8, 22, COLORS.common.track, 0, 0);
      for (let i = -8; i < 10; i += 4) {
        drawRect(ctx, 15, i + trackOffset % 4 - 4, 6, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -16, -12, 32, 26, colors.primary, 0, 0);
      drawRect(ctx, -14, -8, 28, 18, colors.secondary, 0, 0);

      // 炮塔
      ctx.beginPath();
      ctx.arc(0, -2, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();

      // 机炮
      drawRect(ctx, 6, -3, 16, 6, COLORS.common.gun, 0, 0);
      drawRect(ctx, 20, -4, 4, 8, [20,20,20], 0, 0);

      drawRect(ctx, -3, 2, 6, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generatePrismTank() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -20, -16, 40, 32, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);

      // 棱镜炮塔
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba([100, 150, 200]);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba([150, 200, 255]);
      ctx.fill();

      // 棱镜炮
      drawRect(ctx, 8, -6, 20, 12, [100, 180, 255], 0, 0);
      ctx.beginPath();
      ctx.arc(26, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba([200, 230, 255]);
      ctx.fill();

      // 能量脉冲效果
      const pulse = Math.sin(frame * Math.PI) * 3;
      ctx.strokeStyle = `rgba(150, 200, 255, ${0.3 + pulse * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(26, 0, 8 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      drawRect(ctx, -4, -3, 8, 6, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateTeslaTank() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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

      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -20, -16, 40, 32, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);

      // 特斯拉线圈炮塔
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();

      // 特斯拉线圈
      ctx.strokeStyle = rgba(COLORS.common.tesla);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(0, -6);
      ctx.lineTo(8, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(0, 6);
      ctx.lineTo(8, 12);
      ctx.stroke();

      // 电弧效果
      const arcIntensity = Math.sin(frame * Math.PI) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(100, 200, 255, ${arcIntensity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(4 + Math.sin(frame)*2, -2, 2 + Math.cos(frame)*2, 8);
      ctx.stroke();

      drawRect(ctx, -5, -4, 10, 8, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateApocalypse() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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

      drawShadow(ctx, 0, 0, 32);
      const trackOffset = frame * 3 % 8;

      // 重型履带
      drawRect(ctx, -32, -14, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -14; i < 14; i += 4) {
        drawRect(ctx, -31, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 20, -14, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -14; i < 14; i += 4) {
        drawRect(ctx, 21, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      // 巨大车身
      drawRect(ctx, -24, -20, 48, 38, colors.primary, 0, 0);
      drawRect(ctx, -20, -14, 40, 26, colors.secondary, 0, 0);

      // 双炮塔
      ctx.beginPath();
      ctx.arc(-4, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();

      // 双炮管
      drawRect(ctx, 0, -5, 24, 10, COLORS.common.gun, 0, 0);
      drawRect(ctx, 22, -6, 8, 12, [20,20,20], 0, 0);

      // 防空炮
      drawRect(ctx, -18, -8, 6, 16, COLORS.common.gun, 0, 0);
      drawRect(ctx, -20, -12, 10, 4, [50,50,50], 0, 0);

      drawRect(ctx, -6, -2, 12, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateAttackDog() {
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

      drawShadow(ctx, 0, 0, 16);
      const legAnim = Math.sin(frame * Math.PI/2) * 4;

      const dogColor = [139, 90, 43];
      const dogDark = [107, 66, 38];
      const dogLight = [170, 120, 70];

      // 身体
      drawRect(ctx, -8, -2, 16, 8, dogColor, 0, 0);
      drawRect(ctx, -6, 0, 12, 4, dogLight, 0, 0);

      // 四条腿
      drawRect(ctx, -6, 6+legAnim, 3, 6, dogDark, 0, 0);
      drawRect(ctx, -3, 6-legAnim, 3, 6, dogDark, 0, 0);
      drawRect(ctx, 3, 6-legAnim, 3, 6, dogDark, 0, 0);
      drawRect(ctx, 6, 6+legAnim, 3, 6, dogDark, 0, 0);

      // 头部
      drawRect(ctx, 6, -6, 8, 8, dogColor, 0, 0);
      drawRect(ctx, 8, -4, 4, 4, dogLight, 0, 0);

      // 鼻子
      drawRect(ctx, 12, -4, 3, 3, [30, 20, 10], 0, 0);

      // 眼睛
      drawRect(ctx, 10, -5, 2, 2, [20, 20, 20], 0, 0);

      // 尾巴
      drawRect(ctx, -10, -2, 4, 3, dogDark, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateMirage() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const camoColors = {
    primary: [60, 80, 40],
    secondary: [45, 65, 30],
    highlight: [80, 110, 55],
    shadow: [30, 50, 20],
    accent: [100, 140, 70]
  };
  const colors = camoColors;
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

      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -20, -16, 40, 32, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);
      drawRect(ctx, -16, -14, 32, 6, colors.highlight, 0, 0);

      // 迷彩斑点
      drawRect(ctx, -12, -6, 6, 6, [80, 100, 50], 0, 0);
      drawRect(ctx, 4, 2, 8, 5, [50, 70, 35], 0, 0);
      drawRect(ctx, -6, 4, 5, 4, [70, 95, 45], 0, 0);

      // 炮塔
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      // 伪装炮管
      drawRect(ctx, 8, -4, 22, 8, COLORS.common.gun, 0, 0);
      drawRect(ctx, 26, -5, 6, 10, [20,20,20], 0, 0);

      drawRect(ctx, -4, -3, 8, 6, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateGrizzly() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const grizzlyColors = {
    primary: [68, 120, 170],
    secondary: [42, 88, 132],
    highlight: [85, 150, 205],
    shadow: [28, 72, 118],
    accent: [120, 190, 225]
  };
  const colors = grizzlyColors;
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

      drawRect(ctx, -28, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, -27, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -12, 10, 28, COLORS.common.track, 0, 0);
      for (let i = -12; i < 12; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      drawRect(ctx, -20, -16, 40, 32, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);
      drawRect(ctx, -16, -14, 32, 6, colors.highlight, 0, 0);

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      drawRect(ctx, 8, -4, 22, 8, COLORS.common.gun, 0, 0);
      drawRect(ctx, 26, -5, 6, 10, [20,20,20], 0, 0);

      drawRect(ctx, -4, -3, 8, 6, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateDreadnought() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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

      // 船体
      ctx.beginPath();
      ctx.moveTo(-28, 10);
      ctx.lineTo(-22, -16);
      ctx.lineTo(22, -16);
      ctx.lineTo(28, 10);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();

      // 甲板
      drawRect(ctx, -20, -12, 40, 20, colors.secondary, 0, 0);
      drawRect(ctx, -18, -10, 36, 16, colors.highlight, 0, 0);

      // 舰桥
      drawRect(ctx, -10, -14, 20, 10, colors.secondary, 0, 0);
      drawRect(ctx, -8, -16, 16, 6, colors.highlight, 0, 0);

      // 导弹发射架
      drawRect(ctx, -22, -6, 8, 4, [80, 80, 80], 0, 0);
      drawRect(ctx, 14, -6, 8, 4, [80, 80, 80], 0, 0);
      drawRect(ctx, -20, -10, 4, 6, COLORS.common.gun, 0, 0);
      drawRect(ctx, 16, -10, 4, 6, COLORS.common.gun, 0, 0);

      // 水线
      ctx.strokeStyle = rgba([100, 150, 255], 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, 10);
      ctx.lineTo(28, 10);
      ctx.stroke();

      drawRect(ctx, -4, -2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateAegis() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      // 船体
      ctx.beginPath();
      ctx.moveTo(-26, 8);
      ctx.lineTo(-20, -14);
      ctx.lineTo(20, -14);
      ctx.lineTo(26, 8);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();

      // 甲板
      drawRect(ctx, -18, -10, 36, 16, colors.secondary, 0, 0);
      drawRect(ctx, -16, -8, 32, 12, colors.highlight, 0, 0);

      // 宙斯盾雷达
      drawRect(ctx, -8, -14, 16, 8, colors.secondary, 0, 0);
      ctx.beginPath();
      ctx.arc(0, -14, 10, Math.PI, 0);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();
      ctx.strokeStyle = rgba(colors.accent);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -14, 8, Math.PI, 0);
      ctx.stroke();

      // 防空导弹架
      drawRect(ctx, -20, -4, 6, 4, [80, 80, 80], 0, 0);
      drawRect(ctx, 14, -4, 6, 4, [80, 80, 80], 0, 0);

      // 水线
      ctx.strokeStyle = rgba([100, 150, 255], 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, 8);
      ctx.lineTo(26, 8);
      ctx.stroke();

      drawRect(ctx, -4, -2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateGuardianGI() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      drawShadow(ctx, 0, 0, 26);
      const legAnim = Math.sin(frame * Math.PI/2) * 3;

      // 更大的士兵
      drawRect(ctx, -12, 10+legAnim, 10, 16, COLORS.common.pant, 0, 0);
      drawRect(ctx, 2, 10-legAnim, 10, 16, COLORS.common.pant, 0, 0);
      drawRect(ctx, -12, 24+legAnim, 10, 7, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 24-legAnim, 10, 7, COLORS.common.boot, 0, 0);

      drawRect(ctx, -14, -6, 28, 20, colors.primary, 0, 0);
      drawRect(ctx, -12, 2, 24, 8, colors.secondary, 0, 0);
      drawRect(ctx, -12, -2, 24, 5, colors.highlight, 0, 0);
      drawRect(ctx, -14, 10, 28, 5, [74,55,40], 0, 0);

      drawRect(ctx, -7, -16, 14, 14, COLORS.common.skin, 0, 0);
      drawRect(ctx, -9, -20, 18, 8, COLORS.common.helmet, 0, 0);
      drawRect(ctx, -7, -22, 14, 5, COLORS.common.helmet, 0, 0);
      drawRect(ctx, -5, -20, 10, 3, lighten(COLORS.common.helmet,30), 0, 0);

      drawRect(ctx, -5, -12, 4, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -12, 4, 2, [40,30,20], 0, 0);

      // 重型武器
      drawRect(ctx, 12, -4, 12, 10, colors.primary, 0, 0);
      drawRect(ctx, 16, -2, 18, 5, COLORS.common.gun, 0, 0);
      drawRect(ctx, 32, -3, 5, 7, [20,20,20], 0, 0);

      drawRect(ctx, -10, -2, 5, 5, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateBrute() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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

      drawShadow(ctx, 0, 0, 26);
      const legAnim = Math.sin(frame * Math.PI/2) * 3;

      // 更大的苏联士兵
      drawRect(ctx, -12, 10+legAnim, 10, 16, COLORS.common.pantSoviet, 0, 0);
      drawRect(ctx, 2, 10-legAnim, 10, 16, COLORS.common.pantSoviet, 0, 0);
      drawRect(ctx, -12, 24+legAnim, 10, 7, COLORS.common.boot, 0, 0);
      drawRect(ctx, 2, 24-legAnim, 10, 7, COLORS.common.boot, 0, 0);

      drawRect(ctx, -14, -6, 28, 20, colors.primary, 0, 0);
      drawRect(ctx, -12, 2, 24, 8, colors.secondary, 0, 0);
      drawRect(ctx, -12, -2, 24, 5, colors.highlight, 0, 0);
      drawRect(ctx, -14, 10, 28, 5, [74,55,40], 0, 0);

      drawRect(ctx, -7, -16, 14, 14, COLORS.common.skin, 0, 0);
      drawRect(ctx, -9, -20, 18, 8, COLORS.common.helmetSoviet, 0, 0);
      drawRect(ctx, -7, -22, 14, 5, COLORS.common.helmetSoviet, 0, 0);
      drawRect(ctx, -5, -20, 10, 3, lighten(COLORS.common.helmetSoviet,30), 0, 0);

      drawRect(ctx, -5, -12, 4, 2, [40,30,20], 0, 0);
      drawRect(ctx, 1, -12, 4, 2, [40,30,20], 0, 0);

      // 大拳头
      drawRect(ctx, 12, -4, 8, 12, COLORS.common.skin, 0, 0);
      drawRect(ctx, -20, -4, 8, 12, COLORS.common.skin, 0, 0);

      drawRect(ctx, -10, -2, 5, 5, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateMCV(faction) {
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

      drawShadow(ctx, 0, 0, 32);
      const trackOffset = frame * 2 % 8;

      // 重型履带
      drawRect(ctx, -32, -14, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -14; i < 14; i += 4) {
        drawRect(ctx, -31, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 20, -14, 12, 32, COLORS.common.track, 0, 0);
      for (let i = -14; i < 14; i += 4) {
        drawRect(ctx, 21, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      // 大型车身
      drawRect(ctx, -24, -20, 48, 38, colors.primary, 0, 0);
      drawRect(ctx, -20, -14, 40, 26, colors.secondary, 0, 0);
      drawRect(ctx, -20, -18, 40, 8, colors.highlight, 0, 0);

      // 驾驶舱
      drawRect(ctx, -12, -22, 24, 10, colors.highlight, 0, 0);
      drawRect(ctx, -8, -20, 8, 6, COLORS.common.glass, 0, 0);
      drawRect(ctx, 2, -20, 8, 6, COLORS.common.glass, 0, 0);

      // 展开设备
      drawRect(ctx, -16, -6, 32, 14, [80, 80, 80], 0, 0);
      drawRect(ctx, -14, -4, 28, 10, [100, 100, 100], 0, 0);

      // 吊臂
      drawRect(ctx, 14, -16, 4, 20, COLORS.common.gun, 0, 0);
      drawRect(ctx, 14, -18, 12, 4, COLORS.common.gun, 0, 0);

      drawRect(ctx, -6, -2, 12, 6, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateDolphin() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      const swimAnim = Math.sin(frame * Math.PI/2) * 3;

      drawShadow(ctx, 0, 0, 20);

      // 身体 - 蓝灰色流线型
      ctx.beginPath();
      ctx.ellipse(0, swimAnim, 22, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba([140, 160, 180]);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, swimAnim, 18, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba([160, 180, 200]);
      ctx.fill();

      // 背鳍
      ctx.beginPath();
      ctx.moveTo(-2, swimAnim - 8);
      ctx.lineTo(6, swimAnim - 16);
      ctx.lineTo(10, swimAnim - 8);
      ctx.fillStyle = rgba([120, 140, 160]);
      ctx.fill();

      // 尾鳍
      const tailWag = Math.sin(frame * Math.PI) * 4;
      ctx.beginPath();
      ctx.moveTo(-20, swimAnim);
      ctx.lineTo(-28, swimAnim - 6 + tailWag);
      ctx.lineTo(-28, swimAnim + 6 + tailWag);
      ctx.closePath();
      ctx.fillStyle = rgba([120, 140, 160]);
      ctx.fill();

      // 吻部
      drawRect(ctx, 18, swimAnim - 2, 8, 4, [130, 150, 170], 0, 0);

      // 眼睛
      drawRect(ctx, 10, swimAnim - 4, 3, 3, [30, 30, 50], 0, 0);

      // 阵营标记
      drawRect(ctx, -4, swimAnim - 2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateSquid() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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

      const swimAnim = Math.sin(frame * Math.PI/2) * 2;

      drawShadow(ctx, 0, 0, 22);

      // 头部 - 深红/棕色
      ctx.beginPath();
      ctx.ellipse(4, swimAnim, 14, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba([120, 40, 30]);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4, swimAnim, 10, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba([140, 50, 35]);
      ctx.fill();

      // 触手
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI - Math.PI/2 + Math.PI;
        const tentacleAnim = Math.sin(frame * Math.PI/2 + i) * 3;
        const tx = -8 + Math.cos(angle) * 4;
        const ty = swimAnim + 14 + Math.sin(angle) * 4;
        ctx.strokeStyle = rgba([100, 30, 20]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx, swimAnim + 12);
        ctx.quadraticCurveTo(tx - 4, ty + 4 + tentacleAnim, tx - 6, ty + 10 + tentacleAnim);
        ctx.stroke();
      }

      // 眼睛
      drawRect(ctx, 8, swimAnim - 6, 4, 4, [255, 200, 50], 0, 0);
      drawRect(ctx, 9, swimAnim - 5, 2, 2, [30, 10, 10], 0, 0);

      // 阵营标记
      drawRect(ctx, 0, swimAnim - 2, 6, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateCarrier() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      const bobAnim = Math.sin(frame * Math.PI/2) * 2;

      drawShadow(ctx, 0, 0, 30);

      // 船体
      drawRect(ctx, -28, -8 + bobAnim, 56, 20, colors.primary, 0, 0);
      drawRect(ctx, -26, -4 + bobAnim, 52, 14, colors.secondary, 0, 0);
      drawRect(ctx, -28, -10 + bobAnim, 56, 6, colors.highlight, 0, 0);

      // 飞行甲板
      drawRect(ctx, -24, -14 + bobAnim, 40, 8, [180, 180, 180], 0, 0);
      drawRect(ctx, -22, -12 + bobAnim, 36, 4, [200, 200, 200], 0, 0);

      // 舰岛
      drawRect(ctx, 16, -20 + bobAnim, 10, 12, colors.primary, 0, 0);
      drawRect(ctx, 18, -18 + bobAnim, 6, 4, COLORS.common.glass, 0, 0);

      // 雷达天线
      drawRect(ctx, 19, -26 + bobAnim, 4, 8, [80, 80, 80], 0, 0);
      drawRect(ctx, 16, -26 + bobAnim, 10, 2, [100, 100, 100], 0, 0);

      // 飞机
      drawRect(ctx, -16, -12 + bobAnim, 8, 3, [160, 160, 160], 0, 0);
      drawRect(ctx, -6, -12 + bobAnim, 8, 3, [160, 160, 160], 0, 0);

      // 阵营标记
      drawRect(ctx, -4, 2 + bobAnim, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateV3Rocket() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.soviet;
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
      const trackOffset = frame * 2 % 8;

      // 履带
      drawRect(ctx, -26, -10, 10, 24, COLORS.common.track, 0, 0);
      for (let i = -10; i < 12; i += 4) {
        drawRect(ctx, -25, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 16, -10, 10, 24, COLORS.common.track, 0, 0);
      for (let i = -10; i < 12; i += 4) {
        drawRect(ctx, 17, i + trackOffset % 4 - 4, 8, 2, COLORS.common.trackLight, 0, 0);
      }

      // 车身
      drawRect(ctx, -18, -14, 36, 28, colors.primary, 0, 0);
      drawRect(ctx, -16, -10, 32, 20, colors.secondary, 0, 0);
      drawRect(ctx, -16, -12, 32, 6, colors.highlight, 0, 0);

      // 大型火箭发射架
      drawRect(ctx, -10, -18, 20, 6, [80, 80, 80], 0, 0);
      drawRect(ctx, -8, -20, 16, 4, [100, 100, 100], 0, 0);

      // 火箭弹
      drawRect(ctx, -6, -28, 12, 10, [180, 60, 40], 0, 0);
      drawRect(ctx, -4, -30, 8, 4, [200, 80, 50], 0, 0);
      drawRect(ctx, -3, -32, 6, 4, [220, 100, 60], 0, 0);

      // 火箭尾焰（动画）
      if (frame > 0) {
        const flameLen = 4 + frame * 2;
        drawRect(ctx, -4, -28 - flameLen, 8, flameLen, [255, 150, 50], 0, 0);
        drawRect(ctx, -2, -28 - flameLen - 2, 4, 4, [255, 220, 100], 0, 0);
      }

      // 阵营标记
      drawRect(ctx, -4, -2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateChronoMiner(faction) {
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

      // 履带
      drawRect(ctx, -30, -10, 12, 28, COLORS.common.track, 0, 0);
      for (let i = -10; i < 16; i += 4) {
        drawRect(ctx, -29, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }
      drawRect(ctx, 18, -10, 12, 28, COLORS.common.track, 0, 0);
      for (let i = -10; i < 16; i += 4) {
        drawRect(ctx, 19, i + trackOffset % 4 - 4, 10, 2, COLORS.common.trackLight, 0, 0);
      }

      // 车身
      drawRect(ctx, -22, -16, 44, 34, colors.primary, 0, 0);
      drawRect(ctx, -20, -10, 40, 24, colors.secondary, 0, 0);
      drawRect(ctx, -20, -14, 40, 8, colors.highlight, 0, 0);

      // 矿斗
      drawRect(ctx, -16, -12, 32, 16, [255, 179, 71], 0, 0);
      for (let i = 0; i < 3; i++) {
        const anim = Math.sin(frame + i) * 3;
        drawRect(ctx, -12 + i * 10 + anim, -8, 6, 8, [255, 225, 100], 0, 0);
      }

      // 时空传送装置（顶部蓝色圆盘）
      drawRect(ctx, -8, -22, 16, 8, [60, 80, 140], 0, 0);
      ctx.beginPath();
      ctx.arc(0, -22, 8, 0, Math.PI * 2);
      ctx.fillStyle = rgba([80, 120, 200]);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -22, 5, 0, Math.PI * 2);
      ctx.fillStyle = rgba([100, 200, 255]);
      ctx.fill();

      // 时空闪烁动画
      const chronoPulse = Math.sin(frame * Math.PI/2) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(0, -22, 3, 0, Math.PI * 2);
      ctx.fillStyle = rgba([180, 220, 255], Math.floor(chronoPulse * 255));
      ctx.fill();

      // 驾驶舱
      drawRect(ctx, -10, -18, 8, 4, COLORS.common.glass, 0, 0);
      drawRect(ctx, 2, -18, 8, 4, COLORS.common.glass, 0, 0);

      // 阵营标记
      drawRect(ctx, -4, 2, 8, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

function generateHarrier() {
  const width = SPRITE_SIZE * FRAMES;
  const height = SPRITE_SIZE * DIRECTIONS;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = COLORS.allied;
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

      const floatOffset = Math.sin(frame * Math.PI/2) * 3;

      drawShadow(ctx, 0, 0, 22);

      // 机身 - 固定翼战斗机
      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 24, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, floatOffset, 20, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.highlight);
      ctx.fill();

      // 三角翼
      ctx.beginPath();
      ctx.moveTo(-6, floatOffset);
      ctx.lineTo(-16, floatOffset - 16);
      ctx.lineTo(-2, floatOffset - 4);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, floatOffset);
      ctx.lineTo(-16, floatOffset + 16);
      ctx.lineTo(-2, floatOffset + 4);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.secondary);
      ctx.fill();

      // 尾翼
      ctx.beginPath();
      ctx.moveTo(-20, floatOffset);
      ctx.lineTo(-26, floatOffset - 8);
      ctx.lineTo(-22, floatOffset);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-20, floatOffset);
      ctx.lineTo(-26, floatOffset + 8);
      ctx.lineTo(-22, floatOffset);
      ctx.closePath();
      ctx.fillStyle = rgba(colors.primary);
      ctx.fill();

      // 座舱
      drawRect(ctx, 6, floatOffset - 3, 8, 6, COLORS.common.glass, 0, 0);

      // 机头
      drawRect(ctx, 20, floatOffset - 2, 6, 4, darken(colors.primary, 20), 0, 0);

      // 引擎尾焰
      const flameLen = 3 + frame * 2;
      drawRect(ctx, -24 - flameLen, floatOffset - 2, flameLen, 4, [255, 150, 50], 0, 0);
      drawRect(ctx, -24 - flameLen - 2, floatOffset - 1, 4, 2, [255, 220, 100], 0, 0);

      // 阵营标记
      drawRect(ctx, -2, floatOffset - 2, 6, 4, colors.accent, 0, 0);

      ctx.restore();
    }
  }
  return canvas;
}

// ============ 建筑精灵图生成 ============

function generateBuilding(type, faction) {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const colors = faction === 'allied' ? COLORS.allied : COLORS.soviet;

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(64, 100, 45, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'command') {
    drawRect(ctx, 10, 30, 108, 70, colors.primary);
    drawRect(ctx, 12, 32, 104, 66, colors.secondary);
    drawRect(ctx, 10, 30, 108, 12, colors.highlight);
    drawRect(ctx, 40, 10, 48, 28, colors.secondary);
    drawRect(ctx, 42, 12, 44, 24, colors.highlight);
    for (let y = 50; y < 90; y += 16) {
      for (let x = 22; x < 100; x += 16) {
        drawRect(ctx, x, y, 8, 8, COLORS.common.glass);
      }
    }
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
    drawRect(ctx, 10, 40, 108, 60, colors.primary);
    drawRect(ctx, 12, 42, 104, 56, colors.secondary);
    drawRect(ctx, 10, 40, 108, 10, colors.highlight);
    drawRect(ctx, 46, 70, 36, 30, [107,66,38]);
    drawRect(ctx, 20, 55, 10, 10, COLORS.common.glass);
    drawRect(ctx, 98, 55, 10, 10, COLORS.common.glass);
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
    drawRect(ctx, 10, 45, 108, 55, colors.primary);
    drawRect(ctx, 12, 47, 104, 51, colors.secondary);
    drawRect(ctx, 10, 45, 108, 10, colors.highlight);
    drawRect(ctx, 25, 25, 78, 25, [255, 179, 71]);
    drawRect(ctx, 27, 27, 74, 21, [255, 225, 100]);
    for (let i = 0; i < 5; i++) {
      const ox = 30 + i * 14;
      drawRect(ctx, ox, 30, 6, 8, [255, 179, 71]);
    }
    drawRect(ctx, 40, 85, 48, 15, [100, 100, 100]);
    drawRect(ctx, 18, 55, 8, 8, COLORS.common.glass);
    drawRect(ctx, 102, 55, 8, 8, COLORS.common.glass);
  }
  else if (type === 'warfactory') {
    drawRect(ctx, 8, 35, 112, 65, colors.primary);
    drawRect(ctx, 10, 37, 108, 61, colors.secondary);
    drawRect(ctx, 8, 35, 112, 12, colors.highlight);
    drawRect(ctx, 30, 55, 68, 45, [100, 100, 100]);
    drawRect(ctx, 32, 57, 64, 41, [130, 130, 130]);
    drawRect(ctx, 28, 60, 6, 35, [80, 80, 80]);
    drawRect(ctx, 94, 60, 6, 35, [80, 80, 80]);
    drawRect(ctx, 15, 45, 10, 10, COLORS.common.glass);
    drawRect(ctx, 103, 45, 10, 10, COLORS.common.glass);
    ctx.strokeStyle = rgba(colors.primary);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 35);
    ctx.lineTo(64, 15);
    ctx.lineTo(85, 15);
    ctx.stroke();
  }
  else if (type === 'power') {
    drawRect(ctx, 15, 40, 98, 60, colors.primary);
    drawRect(ctx, 17, 42, 94, 56, colors.secondary);
    drawRect(ctx, 15, 40, 98, 8, colors.highlight);
    
    // 发电站主体
    drawRect(ctx, 30, 20, 68, 25, colors.secondary);
    drawRect(ctx, 32, 22, 64, 21, colors.highlight);
    
    // 电线
    ctx.strokeStyle = rgba([100, 100, 100]);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = 35 + i * 18;
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 20);
      ctx.stroke();
    }
    
    // 闪电图标
    ctx.fillStyle = rgba(COLORS.common.gold);
    ctx.beginPath();
    ctx.moveTo(64, 25);
    ctx.lineTo(58, 35);
    ctx.lineTo(64, 35);
    ctx.lineTo(56, 45);
    ctx.lineTo(68, 32);
    ctx.closePath();
    ctx.fill();
  }
  else if (type === 'radar') {
    drawRect(ctx, 15, 45, 98, 55, colors.primary);
    drawRect(ctx, 17, 47, 94, 51, colors.secondary);
    drawRect(ctx, 15, 45, 98, 8, colors.highlight);
    
    // 雷达天线塔
    drawRect(ctx, 45, 15, 38, 8, colors.secondary);
    drawRect(ctx, 47, 17, 34, 4, colors.highlight);
    
    // 雷达圆盘
    const rotation = 0.2;
    ctx.save();
    ctx.translate(64, 25);
    ctx.rotate(rotation);
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // 显示屏
    drawRect(ctx, 50, 60, 28, 18, [30, 30, 30]);
    drawRect(ctx, 52, 62, 24, 14, [0, 100, 0]);
  }
  else if (type === 'tech') {
    drawRect(ctx, 10, 35, 108, 65, [80, 80, 80]);
    drawRect(ctx, 12, 37, 104, 61, [60, 60, 60]);
    drawRect(ctx, 10, 35, 108, 10, [100, 100, 100]);
    
    // 科技感装饰
    drawRect(ctx, 30, 20, 68, 20, [60, 80, 100]);
    drawRect(ctx, 32, 22, 64, 16, [80, 100, 120]);
    
    // 发光效果
    const gradient = ctx.createRadialGradient(64, 55, 0, 64, 55, 40);
    gradient.addColorStop(0, 'rgba(0, 200, 255, 0.3)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(20, 20, 88, 80);
    
    // 危险标志
    ctx.fillStyle = rgba([255, 0, 0]);
    ctx.beginPath();
    ctx.moveTo(64, 25);
    ctx.lineTo(60, 35);
    ctx.lineTo(64, 35);
    ctx.lineTo(56, 45);
    ctx.lineTo(72, 32);
    ctx.closePath();
    ctx.fill();
  }
  else if (type === 'repair') {
    drawRect(ctx, 15, 40, 98, 60, colors.primary);
    drawRect(ctx, 17, 42, 94, 56, colors.secondary);
    drawRect(ctx, 15, 40, 98, 8, colors.highlight);
    
    // 修理平台
    drawRect(ctx, 25, 75, 78, 20, [100, 100, 100]);
    drawRect(ctx, 27, 77, 74, 16, [130, 130, 130]);
    
    // 工具图标
    ctx.fillStyle = rgba([255, 200, 50]);
    drawRect(ctx, 50, 50, 8, 20, [100, 100, 100]);
    ctx.beginPath();
    ctx.moveTo(54, 50);
    ctx.lineTo(68, 42);
    ctx.lineTo(64, 50);
    ctx.closePath();
    ctx.fill();
  }
  else if (type === 'wall') {
    ctx.fillStyle = 'rgba(100, 100, 100, 0.9)';
    for (let i = 0; i < 4; i++) {
      drawRect(ctx, 10 + i * 30, 50, 25, 35, [100, 100, 100]);
      drawRect(ctx, 12 + i * 30, 52, 21, 31, [130, 130, 130]);
    }
    // 城墙顶部装饰
    for (let i = 0; i < 4; i++) {
      drawRect(ctx, 15 + i * 30, 45, 15, 8, [80, 80, 80]);
    }
  }
  else if (type === 'airfield') {
    drawRect(ctx, 8, 40, 112, 60, [60, 60, 60]);
    drawRect(ctx, 10, 42, 108, 56, [80, 80, 80]);
    drawRect(ctx, 20, 55, 88, 30, [40, 40, 40]);
    drawRect(ctx, 22, 57, 84, 26, [50, 50, 50]);
    drawRect(ctx, 50, 15, 28, 30, colors.primary);
    drawRect(ctx, 52, 17, 24, 26, colors.secondary);
    drawRect(ctx, 50, 15, 28, 8, colors.highlight);
    drawRect(ctx, 58, 20, 12, 8, COLORS.common.glass);
    ctx.fillStyle = rgba(colors.accent);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(25 + i * 18, 75, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  else if (type === 'defense') {
    drawRect(ctx, 20, 50, 88, 50, colors.primary);
    drawRect(ctx, 22, 52, 84, 46, colors.secondary);
    ctx.beginPath();
    ctx.arc(64, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.primary);
    ctx.fill();
    const gunAngle = Math.PI / 4;
    ctx.save();
    ctx.translate(64, 50);
    ctx.rotate(-gunAngle);
    drawRect(ctx, 0, -4, 30, 8, COLORS.common.gun);
    ctx.restore();
    drawRect(ctx, 30, 70, 15, 20, [80, 60, 40]);
    drawRect(ctx, 83, 70, 15, 20, [80, 60, 40]);
  }
  else if (type === 'teslacoil') {
    drawRect(ctx, 30, 50, 68, 50, colors.primary);
    drawRect(ctx, 32, 52, 64, 46, colors.secondary);
    ctx.beginPath();
    ctx.arc(64, 50, 18, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.secondary);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const radius = 8 + i * 3;
      ctx.beginPath();
      ctx.arc(64, 50, radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(COLORS.common.tesla, 0.3 + i * 0.15);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    drawRect(ctx, 60, 20, 8, 32, COLORS.common.tesla);
    ctx.beginPath();
    ctx.arc(64, 20, 6, 0, Math.PI * 2);
    ctx.fillStyle = rgba(COLORS.common.tesla);
    ctx.fill();
  }
  else if (type === 'helipad') {
    drawRect(ctx, 15, 35, 98, 65, colors.primary);
    drawRect(ctx, 17, 37, 94, 61, colors.secondary);
    drawRect(ctx, 15, 35, 98, 8, colors.highlight);
    // Helipad H marking
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(50, 80);
    ctx.moveTo(78, 50);
    ctx.lineTo(78, 80);
    ctx.moveTo(50, 65);
    ctx.lineTo(78, 65);
    ctx.stroke();
  }
  else if (type === 'flame_tower') {
    drawRect(ctx, 30, 50, 68, 50, colors.primary);
    drawRect(ctx, 32, 52, 64, 46, colors.secondary);
    drawRect(ctx, 55, 20, 18, 32, [180, 60, 20]);
    drawRect(ctx, 57, 22, 14, 28, [220, 100, 30]);
    // Flame
    ctx.beginPath();
    ctx.arc(64, 15, 10, 0, Math.PI * 2);
    ctx.fillStyle = rgba([255, 150, 50]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 12, 6, 0, Math.PI * 2);
    ctx.fillStyle = rgba([255, 220, 100]);
    ctx.fill();
  }
  else if (type === 'turret') {
    drawRect(ctx, 35, 55, 58, 45, colors.primary);
    drawRect(ctx, 37, 57, 54, 41, colors.secondary);
    // Gun barrel
    drawRect(ctx, 60, 30, 8, 28, colors.highlight);
    drawRect(ctx, 55, 25, 18, 8, colors.highlight);
    // Sandbags
    drawRect(ctx, 30, 65, 10, 10, [160, 140, 100]);
    drawRect(ctx, 88, 65, 10, 10, [160, 140, 100]);
  }
  else if (type === 'nuclear_silo') {
    drawRect(ctx, 15, 40, 98, 60, colors.primary);
    drawRect(ctx, 17, 42, 94, 56, colors.secondary);
    // Silo dome
    ctx.beginPath();
    ctx.arc(64, 42, 30, Math.PI, 0);
    ctx.fillStyle = rgba(colors.secondary);
    ctx.fill();
    ctx.strokeStyle = rgba([50, 255, 50], 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    // Radiation symbol
    ctx.beginPath();
    ctx.arc(64, 42, 10, 0, Math.PI * 2);
    ctx.fillStyle = rgba([50, 255, 50], 0.7);
    ctx.fill();
  }
  else if (type === 'iron_curtain') {
    drawRect(ctx, 20, 35, 88, 65, colors.primary);
    drawRect(ctx, 22, 37, 84, 61, colors.secondary);
    drawRect(ctx, 20, 35, 88, 8, colors.highlight);
    // Iron curtain coils
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(40 + i * 24, 55, 8, 0, Math.PI * 2);
      ctx.strokeStyle = rgba([150, 150, 200]);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    drawRect(ctx, 55, 20, 18, 18, [150, 150, 200]);
  }
  else if (type === 'chronosphere') {
    drawRect(ctx, 20, 40, 88, 55, colors.primary);
    drawRect(ctx, 22, 42, 84, 51, colors.secondary);
    // Chrono sphere
    ctx.beginPath();
    ctx.arc(64, 40, 22, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 150, 255], 0.6);
    ctx.fill();
    ctx.strokeStyle = rgba([100, 200, 255]);
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner rings
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(64, 40, 8 + i * 4, 0, Math.PI * 2);
      ctx.strokeStyle = rgba([100, 200, 255], 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  else if (type === 'naval_shipyard') {
    drawRect(ctx, 10, 45, 108, 55, colors.primary);
    drawRect(ctx, 12, 47, 104, 51, colors.secondary);
    drawRect(ctx, 10, 45, 108, 8, colors.highlight);
    // Crane
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 45);
    ctx.lineTo(30, 15);
    ctx.lineTo(70, 15);
    ctx.stroke();
    // Water line
    ctx.strokeStyle = rgba([100, 150, 255], 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 95);
    ctx.lineTo(118, 95);
    ctx.stroke();
  }
  else if (type === 'oil_derrick') {
    drawRect(ctx, 40, 50, 48, 50, colors.primary);
    drawRect(ctx, 42, 52, 44, 46, colors.secondary);
    // Pump jack
    ctx.strokeStyle = rgba([80, 80, 80]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 50);
    ctx.lineTo(64, 20);
    ctx.lineTo(85, 35);
    ctx.stroke();
  }
  else if (type === 'hospital') {
    drawRect(ctx, 20, 40, 88, 60, colors.primary);
    drawRect(ctx, 22, 42, 84, 56, [240, 240, 240]);
    // Red cross
    drawRect(ctx, 56, 50, 16, 30, [220, 40, 40]);
    drawRect(ctx, 48, 58, 32, 14, [220, 40, 40]);
  }
  else if (type === 'patriot') {
    drawRect(ctx, 30, 50, 68, 50, colors.primary);
    drawRect(ctx, 32, 52, 64, 46, colors.secondary);
    // 防空炮塔基座
    ctx.beginPath();
    ctx.arc(64, 50, 18, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.secondary);
    ctx.fill();
    // 雷达圆盘
    ctx.beginPath();
    ctx.arc(64, 25, 16, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.highlight);
    ctx.fill();
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(64, 25, 12, 0, Math.PI * 2);
    ctx.stroke();
    // 雷达支架
    drawRect(ctx, 60, 30, 8, 22, colors.primary);
    // 防空导弹
    drawRect(ctx, 50, 40, 6, 16, [80, 80, 80]);
    drawRect(ctx, 72, 40, 6, 16, [80, 80, 80]);
    drawRect(ctx, 48, 36, 4, 8, COLORS.common.gun);
    drawRect(ctx, 76, 36, 4, 8, COLORS.common.gun);
  }
  else if (type === 'sentry_gun') {
    drawRect(ctx, 40, 55, 48, 45, colors.primary);
    drawRect(ctx, 42, 57, 44, 41, colors.secondary);
    // 小型炮塔
    ctx.beginPath();
    ctx.arc(64, 55, 14, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.secondary);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 55, 10, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.highlight);
    ctx.fill();
    // 机枪
    drawRect(ctx, 70, 52, 20, 6, COLORS.common.gun);
    drawRect(ctx, 88, 50, 6, 10, [20, 20, 20]);
    // 弹药箱
    drawRect(ctx, 44, 70, 12, 10, [100, 80, 50]);
    drawRect(ctx, 72, 70, 12, 10, [100, 80, 50]);
  }
  else if (type === 'battle_bunker') {
    drawRect(ctx, 20, 40, 88, 60, colors.primary);
    drawRect(ctx, 22, 42, 84, 56, colors.secondary);
    drawRect(ctx, 20, 40, 88, 10, colors.highlight);
    // 地堡射击孔
    drawRect(ctx, 28, 60, 16, 10, [30, 30, 30]);
    drawRect(ctx, 56, 60, 16, 10, [30, 30, 30]);
    drawRect(ctx, 84, 60, 16, 10, [30, 30, 30]);
    // 沙袋
    drawRect(ctx, 22, 90, 14, 10, [160, 140, 100]);
    drawRect(ctx, 92, 90, 14, 10, [160, 140, 100]);
    // 顶部观察口
    drawRect(ctx, 55, 44, 18, 6, [30, 30, 30]);
  }
  else if (type === 'cloning_vats') {
    drawRect(ctx, 15, 35, 98, 65, [80, 80, 80]);
    drawRect(ctx, 17, 37, 94, 61, [60, 60, 60]);
    drawRect(ctx, 15, 35, 98, 10, [100, 100, 100]);
    // 克隆罐
    for (let i = 0; i < 3; i++) {
      const x = 28 + i * 26;
      ctx.beginPath();
      ctx.arc(x, 55, 10, 0, Math.PI * 2);
      ctx.fillStyle = rgba([0, 200, 100], 0.4);
      ctx.fill();
      ctx.strokeStyle = rgba([0, 200, 100], 0.7);
      ctx.lineWidth = 2;
      ctx.stroke();
      // 液体
      drawRect(ctx, x - 6, 50, 12, 10, [0, 150, 80]);
    }
    // 管道
    ctx.strokeStyle = rgba([120, 120, 120]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, 65);
    ctx.lineTo(80, 65);
    ctx.stroke();
    // 控制面板
    drawRect(ctx, 45, 75, 38, 18, [40, 40, 40]);
    drawRect(ctx, 47, 77, 34, 14, [0, 100, 60]);
  }
  else if (type === 'industrial_plant') {
    drawRect(ctx, 8, 35, 112, 65, colors.primary);
    drawRect(ctx, 10, 37, 108, 61, colors.secondary);
    drawRect(ctx, 8, 35, 112, 12, colors.highlight);
    // 工厂大门
    drawRect(ctx, 30, 55, 68, 45, [100, 100, 100]);
    drawRect(ctx, 32, 57, 64, 41, [130, 130, 130]);
    // 齿轮装饰
    ctx.strokeStyle = rgba(colors.accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(50, 50, 12, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(50 + Math.cos(angle) * 10, 50 + Math.sin(angle) * 10);
      ctx.lineTo(50 + Math.cos(angle) * 16, 50 + Math.sin(angle) * 16);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(78, 50, 10, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(78 + Math.cos(angle) * 8, 50 + Math.sin(angle) * 8);
      ctx.lineTo(78 + Math.cos(angle) * 14, 50 + Math.sin(angle) * 14);
      ctx.stroke();
    }
    // 烟囱
    drawRect(ctx, 95, 15, 12, 24, [80, 80, 80]);
    drawRect(ctx, 97, 17, 8, 20, [100, 100, 100]);
  }
  else if (type === 'psychic_sensor') {
    drawRect(ctx, 15, 45, 98, 55, colors.primary);
    drawRect(ctx, 17, 47, 94, 51, colors.secondary);
    drawRect(ctx, 15, 45, 98, 8, colors.highlight);
    // 心灵感应圆顶
    ctx.beginPath();
    ctx.arc(64, 45, 28, Math.PI, 0);
    ctx.fillStyle = rgba([150, 50, 200], 0.6);
    ctx.fill();
    ctx.strokeStyle = rgba([180, 80, 230]);
    ctx.lineWidth = 2;
    ctx.stroke();
    // 内环
    ctx.beginPath();
    ctx.arc(64, 45, 18, Math.PI, 0);
    ctx.strokeStyle = rgba([200, 100, 255], 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // 脉冲波
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(64, 45, 10 + i * 8, 0, Math.PI * 2);
      ctx.strokeStyle = rgba([180, 80, 230], 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 显示屏
    drawRect(ctx, 45, 65, 38, 18, [30, 30, 30]);
    drawRect(ctx, 47, 67, 34, 14, [80, 0, 120]);
  }
  else if (type === 'civilian_building') {
    drawRect(ctx, 15, 30, 98, 70, [140, 130, 110]);
    drawRect(ctx, 17, 32, 94, 66, [170, 160, 140]);
    drawRect(ctx, 15, 30, 98, 10, [120, 110, 90]);
    // 窗户
    for (let y = 48; y < 85; y += 18) {
      for (let x = 24; x < 100; x += 20) {
        drawRect(ctx, x, y, 10, 10, [80, 120, 160]);
      }
    }
    // 门
    drawRect(ctx, 52, 75, 24, 25, [80, 60, 40]);
    drawRect(ctx, 54, 77, 20, 23, [100, 80, 60]);
  }
  else if (type === 'biolab') {
    drawRect(ctx, 15, 35, 98, 65, [80, 100, 80]);
    drawRect(ctx, 17, 37, 94, 61, [100, 130, 100]);
    drawRect(ctx, 15, 35, 98, 10, [60, 80, 60]);
    // 实验室窗户
    drawRect(ctx, 25, 50, 20, 14, [150, 220, 150]);
    drawRect(ctx, 83, 50, 20, 14, [150, 220, 150]);
    // 生物危险标志
    ctx.fillStyle = rgba([255, 200, 0]);
    ctx.beginPath();
    ctx.arc(64, 60, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba([80, 100, 80]);
    ctx.beginPath();
    ctx.arc(64, 60, 4, 0, Math.PI * 2);
    ctx.fill();
    // 通风管道
    drawRect(ctx, 40, 20, 8, 18, [100, 100, 100]);
    drawRect(ctx, 80, 20, 8, 18, [100, 100, 100]);
    // 入口
    drawRect(ctx, 50, 80, 28, 20, [60, 80, 60]);
  }
  else if (type === 'machine_shop') {
    drawRect(ctx, 15, 40, 98, 60, [100, 90, 80]);
    drawRect(ctx, 17, 42, 94, 56, [130, 120, 110]);
    drawRect(ctx, 15, 40, 98, 8, [80, 70, 60]);
    // 修理平台
    drawRect(ctx, 25, 75, 78, 20, [100, 100, 100]);
    drawRect(ctx, 27, 77, 74, 16, [130, 130, 130]);
    // 扳手图标
    ctx.strokeStyle = rgba([255, 200, 50]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(55, 50);
    ctx.lineTo(73, 68);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(53, 48, 6, 0, Math.PI * 2);
    ctx.stroke();
    // 齿轮
    ctx.strokeStyle = rgba([180, 180, 180]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(80, 55, 8, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(80 + Math.cos(angle) * 6, 55 + Math.sin(angle) * 6);
      ctx.lineTo(80 + Math.cos(angle) * 11, 55 + Math.sin(angle) * 11);
      ctx.stroke();
    }
  }
  else if (type === 'bridge') {
    // 桥面
    drawRect(ctx, 4, 45, 120, 20, [120, 110, 100]);
    drawRect(ctx, 6, 47, 116, 16, [150, 140, 130]);
    // 桥栏杆
    drawRect(ctx, 4, 40, 120, 6, [100, 90, 80]);
    drawRect(ctx, 4, 64, 120, 4, [100, 90, 80]);
    // 桥墩
    drawRect(ctx, 20, 64, 12, 30, [90, 80, 70]);
    drawRect(ctx, 96, 64, 12, 30, [90, 80, 70]);
    drawRect(ctx, 56, 64, 16, 30, [90, 80, 70]);
    // 水面
    ctx.strokeStyle = rgba([100, 150, 255], 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 94);
    ctx.lineTo(124, 94);
    ctx.stroke();
  }
  else if (type === 'bridge_destroyed') {
    // 残余桥面左
    drawRect(ctx, 4, 45, 50, 20, [120, 110, 100]);
    drawRect(ctx, 6, 47, 46, 16, [150, 140, 130]);
    // 残余桥面右
    drawRect(ctx, 74, 45, 50, 20, [120, 110, 100]);
    drawRect(ctx, 76, 47, 46, 16, [150, 140, 130]);
    // 断裂边缘
    drawRect(ctx, 50, 48, 26, 16, [80, 70, 60]);
    // 碎片
    drawRect(ctx, 52, 60, 8, 8, [100, 90, 80]);
    drawRect(ctx, 66, 58, 6, 6, [90, 80, 70]);
    // 残余桥墩
    drawRect(ctx, 20, 64, 12, 20, [90, 80, 70]);
    drawRect(ctx, 96, 64, 12, 20, [90, 80, 70]);
    // 断裂桥墩
    drawRect(ctx, 58, 70, 12, 10, [70, 60, 50]);
    // 水面
    ctx.strokeStyle = rgba([100, 150, 255], 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 90);
    ctx.lineTo(124, 90);
    ctx.stroke();
  }
  else if (type === 'gap_generator') {
    // 间隙发生器 - 盟军天线塔，蓝色电弧
    drawRect(ctx, 54, 20, 20, 80, colors.secondary);
    drawRect(ctx, 56, 22, 16, 76, colors.highlight);
    // 天线
    drawRect(ctx, 62, 4, 4, 20, [80, 80, 80]);
    drawRect(ctx, 56, 4, 16, 3, [100, 100, 100]);
    // 顶部发射器
    ctx.beginPath();
    ctx.arc(64, 6, 8, 0, Math.PI * 2);
    ctx.fillStyle = rgba([60, 100, 180]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 180, 255]);
    ctx.fill();
    // 蓝色电弧
    ctx.strokeStyle = rgba([100, 200, 255], 180);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(angle) * 8, 6 + Math.sin(angle) * 8);
      ctx.lineTo(64 + Math.cos(angle) * 18, 6 + Math.sin(angle) * 18);
      ctx.stroke();
    }
    // 底座
    drawRect(ctx, 44, 90, 40, 16, colors.primary);
    drawRect(ctx, 46, 92, 36, 12, colors.secondary);
    // 阵营标记
    drawRect(ctx, 56, 94, 16, 4, colors.accent);
  }
  else if (type === 'nuclear_reactor') {
    // 核反应堆 - 苏联大型穹顶，辐射标志，绿色辉光
    drawRect(ctx, 20, 50, 88, 50, colors.primary);
    drawRect(ctx, 22, 52, 84, 46, colors.secondary);
    // 穹顶
    ctx.beginPath();
    ctx.arc(64, 50, 40, Math.PI, 0);
    ctx.fillStyle = rgba(colors.primary);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 50, 36, Math.PI, 0);
    ctx.fillStyle = rgba(colors.highlight);
    ctx.fill();
    // 辐射标志
    ctx.fillStyle = rgba([255, 255, 0]);
    ctx.beginPath();
    ctx.arc(64, 50, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(colors.primary);
    ctx.beginPath();
    ctx.arc(64, 50, 6, 0, Math.PI * 2);
    ctx.fill();
    // 辐射扇叶
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(64, 50);
      ctx.arc(64, 50, 12, a - 0.3, a + 0.3);
      ctx.closePath();
      ctx.fillStyle = rgba([255, 255, 0]);
      ctx.fill();
    }
    // 绿色辉光
    const glow = ctx.createRadialGradient(64, 50, 10, 64, 50, 50);
    glow.addColorStop(0, 'rgba(0, 255, 0, 0.15)');
    glow.addColorStop(1, 'rgba(0, 255, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(64, 50, 50, 0, Math.PI * 2);
    ctx.fill();
    // 冷却塔
    drawRect(ctx, 28, 30, 12, 24, [80, 80, 80]);
    drawRect(ctx, 30, 32, 8, 20, [100, 100, 100]);
    drawRect(ctx, 88, 30, 12, 24, [80, 80, 80]);
    drawRect(ctx, 90, 32, 8, 20, [100, 100, 100]);
    // 阵营标记
    drawRect(ctx, 52, 80, 24, 4, colors.accent);
  }
  else if (type === 'flak_cannon') {
    // 防空炮 - 苏联4管高射炮
    drawRect(ctx, 30, 70, 68, 30, colors.primary);
    drawRect(ctx, 32, 72, 64, 26, colors.secondary);
    // 旋转底座
    ctx.beginPath();
    ctx.arc(64, 70, 20, 0, Math.PI * 2);
    ctx.fillStyle = rgba([80, 80, 80]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 70, 14, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 100, 100]);
    ctx.fill();
    // 4根炮管朝上
    drawRect(ctx, 48, 20, 4, 50, COLORS.common.gun);
    drawRect(ctx, 56, 16, 4, 54, COLORS.common.gun);
    drawRect(ctx, 68, 16, 4, 54, COLORS.common.gun);
    drawRect(ctx, 76, 20, 4, 50, COLORS.common.gun);
    // 炮口
    drawRect(ctx, 46, 18, 8, 4, [40, 40, 40]);
    drawRect(ctx, 54, 14, 8, 4, [40, 40, 40]);
    drawRect(ctx, 66, 14, 8, 4, [40, 40, 40]);
    drawRect(ctx, 74, 18, 8, 4, [40, 40, 40]);
    // 弹药箱
    drawRect(ctx, 36, 76, 12, 10, [60, 60, 60]);
    drawRect(ctx, 80, 76, 12, 10, [60, 60, 60]);
    // 阵营标记
    drawRect(ctx, 52, 80, 24, 4, colors.accent);
  }
  else if (type === 'spy_satellite') {
    // 间谍卫星 - 盟军卫星碟形天线朝上
    drawRect(ctx, 44, 80, 40, 20, colors.primary);
    drawRect(ctx, 46, 82, 36, 16, colors.secondary);
    // 支撑柱
    drawRect(ctx, 60, 40, 8, 44, [80, 80, 80]);
    drawRect(ctx, 62, 42, 4, 40, [100, 100, 100]);
    // 碟形天线
    ctx.beginPath();
    ctx.ellipse(64, 36, 30, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba([180, 180, 180]);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(64, 34, 26, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba([200, 200, 200]);
    ctx.fill();
    // 天线中心
    ctx.beginPath();
    ctx.arc(64, 34, 6, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors.highlight);
    ctx.fill();
    // 信号接收器
    drawRect(ctx, 62, 20, 4, 16, [60, 60, 60]);
    ctx.beginPath();
    ctx.arc(64, 18, 4, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 200, 255]);
    ctx.fill();
    // 阵营标记
    drawRect(ctx, 52, 86, 24, 4, colors.accent);
  }
  else if (type === 'ore_purifier') {
    // 矿石精炼器 - 盟军精炼厂加蓝色过滤管
    drawRect(ctx, 10, 40, 108, 60, colors.primary);
    drawRect(ctx, 12, 42, 104, 56, colors.secondary);
    drawRect(ctx, 10, 40, 108, 10, colors.highlight);
    // 精炼罐
    ctx.beginPath();
    ctx.arc(40, 50, 16, 0, Math.PI * 2);
    ctx.fillStyle = rgba([200, 180, 100]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(40, 50, 12, 0, Math.PI * 2);
    ctx.fillStyle = rgba([220, 200, 120]);
    ctx.fill();
    // 蓝色过滤管
    drawRect(ctx, 56, 44, 6, 30, [60, 100, 180]);
    drawRect(ctx, 66, 44, 6, 30, [60, 100, 180]);
    drawRect(ctx, 76, 44, 6, 30, [60, 100, 180]);
    // 管道连接
    drawRect(ctx, 54, 50, 30, 4, [80, 120, 200]);
    drawRect(ctx, 54, 62, 30, 4, [80, 120, 200]);
    // 蓝色过滤器
    ctx.beginPath();
    ctx.arc(88, 55, 10, 0, Math.PI * 2);
    ctx.fillStyle = rgba([60, 120, 200]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(88, 55, 6, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 180, 255]);
    ctx.fill();
    // 窗户
    for (let x = 18; x < 50; x += 16) {
      drawRect(ctx, x, 72, 8, 8, COLORS.common.glass);
    }
    // 阵营标记
    drawRect(ctx, 52, 86, 24, 4, colors.accent);
  }
  else if (type === 'grand_cannon') {
    // 巨炮 - 法国超大型炮管
    drawRect(ctx, 20, 70, 88, 30, COLORS.france.primary);
    drawRect(ctx, 22, 72, 84, 26, COLORS.france.secondary);
    drawRect(ctx, 20, 70, 88, 8, COLORS.france.highlight);
    // 旋转底座
    ctx.beginPath();
    ctx.arc(64, 70, 24, 0, Math.PI * 2);
    ctx.fillStyle = rgba([80, 80, 80]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 70, 18, 0, Math.PI * 2);
    ctx.fillStyle = rgba([100, 100, 100]);
    ctx.fill();
    // 超大型炮管
    drawRect(ctx, 58, 10, 12, 62, COLORS.common.gun);
    drawRect(ctx, 60, 8, 8, 64, [40, 40, 40]);
    // 炮口制退器
    drawRect(ctx, 54, 6, 20, 6, [50, 50, 50]);
    drawRect(ctx, 56, 4, 16, 4, [60, 60, 60]);
    // 装甲护盾
    drawRect(ctx, 50, 56, 28, 16, COLORS.france.primary);
    drawRect(ctx, 52, 58, 24, 12, COLORS.france.highlight);
    // 阵营标记
    drawRect(ctx, 52, 82, 24, 4, COLORS.france.accent);
  }

  return canvas;
}

function saveCanvas(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`生成了: ${path.basename(filename)}`);
}

async function main() {
  console.log('🎨 正在生成完整的精灵图集...\n');

  const outDir = path.join(__dirname, '../public/assets/sprites');
  fs.mkdirSync(path.join(outDir, 'units'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'buildings'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'effects'), { recursive: true });

  console.log('💥 生成特效精灵图...');
  for (let i = 0; i < FRAMES; i++) {
    saveCanvas(drawExplosion(i, 64), path.join(outDir, 'effects/explosion_' + i + '.png'));
    saveCanvas(drawSmoke(i, 32), path.join(outDir, 'effects/smoke_' + i + '.png'));
    saveCanvas(drawMuzzleFlash(i, 32), path.join(outDir, 'effects/muzzle_' + i + '.png'));
  }
  
  console.log('\n📦 生成单位精灵图...');
  
  // 基础单位
  saveCanvas(generateSoldier('allied'), path.join(outDir, 'units/allied_soldier.png'));
  saveCanvas(generateSoldier('soviet'), path.join(outDir, 'units/soviet_soldier.png'));
  saveCanvas(generateTank('allied'), path.join(outDir, 'units/allied_tank.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_tank.png'));
  saveCanvas(generateEngineer('allied'), path.join(outDir, 'units/allied_engineer.png'));
  saveCanvas(generateEngineer('soviet'), path.join(outDir, 'units/soviet_engineer.png'));
  saveCanvas(generateMiner('allied'), path.join(outDir, 'units/allied_miner.png'));
  saveCanvas(generateMiner('soviet'), path.join(outDir, 'units/soviet_miner.png'));
  saveCanvas(generateHelicopter('allied'), path.join(outDir, 'units/allied_helicopter.png'));
  saveCanvas(generateHelicopter('soviet'), path.join(outDir, 'units/soviet_helicopter.png'));
  
  // 特殊单位
  saveCanvas(generateRocketSoldier('allied'), path.join(outDir, 'units/allied_rocket.png'));
  saveCanvas(generateRocketSoldier('soviet'), path.join(outDir, 'units/soviet_rocket.png'));
  saveCanvas(generateSniper('allied'), path.join(outDir, 'units/allied_sniper.png'));
  saveCanvas(generateTanya(), path.join(outDir, 'units/allied_tanya.png'));
  
  // 载具
  saveCanvas(generateIFV('allied'), path.join(outDir, 'units/allied_ifv.png'));
  saveCanvas(generatePrismTank(), path.join(outDir, 'units/allied_prism.png'));
  saveCanvas(generateTeslaTank(), path.join(outDir, 'units/soviet_tesla.png'));
  saveCanvas(generateApocalypse(), path.join(outDir, 'units/soviet_apocalypse.png'));

  // 额外单位 - 复用现有生成器
  saveCanvas(generateTank('allied'), path.join(outDir, 'units/allied_guardian.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_rhino.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_despot.png'));
  saveCanvas(generateTank('allied'), path.join(outDir, 'units/allied_phantom.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_flak.png'));
  saveCanvas(generateIFV('soviet'), path.join(outDir, 'units/soviet_apc.png'));
  saveCanvas(generateSoldier('soviet'), path.join(outDir, 'units/soviet_conscript.png'));
  saveCanvas(generateRocketSoldier('soviet'), path.join(outDir, 'units/soviet_flakinfantry.png'));
  saveCanvas(generateSoldier('soviet'), path.join(outDir, 'units/soviet_terrorist.png'));
  saveCanvas(generateSoldier('soviet'), path.join(outDir, 'units/soviet_ivan.png'));
  saveCanvas(generateSniper('allied'), path.join(outDir, 'units/allied_seal.png'));
  saveCanvas(generateSoldier('allied'), path.join(outDir, 'units/allied_chrono.png'));
  saveCanvas(generateSpy('allied'), path.join(outDir, 'units/allied_spy.png'));
  saveCanvas(generateHelicopter('allied'), path.join(outDir, 'units/allied_blackhawk.png'));
  saveCanvas(generateHelicopter('soviet'), path.join(outDir, 'units/soviet_kirov.png'));
  saveCanvas(generateHelicopter('soviet'), path.join(outDir, 'units/soviet_yak.png'));

  // 海军单位
  saveCanvas(generateTank('allied'), path.join(outDir, 'units/allied_destroyer.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_submarine.png'));
  saveCanvas(generateMiner('allied'), path.join(outDir, 'units/allied_transport_ship.png'));

  // 新增单位
  saveCanvas(generateAttackDog(), path.join(outDir, 'units/soviet_attack_dog.png'));
  saveCanvas(generateMiner('soviet'), path.join(outDir, 'units/soviet_war_miner.png'));
  saveCanvas(generateMirage(), path.join(outDir, 'units/allied_mirage.png'));
  saveCanvas(generateGrizzly(), path.join(outDir, 'units/allied_grizzly.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_lash.png'));
  saveCanvas(generateDreadnought(), path.join(outDir, 'units/soviet_dreadnought.png'));
  saveCanvas(generateAegis(), path.join(outDir, 'units/allied_aegis.png'));
  saveCanvas(generateSoldier('allied'), path.join(outDir, 'units/allied_gi.png'));
  saveCanvas(generateGuardianGI(), path.join(outDir, 'units/allied_guardian_gi.png'));
  saveCanvas(generateBrute(), path.join(outDir, 'units/soviet_brute.png'));
  saveCanvas(generateHelicopter('soviet'), path.join(outDir, 'units/soviet_disc.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_boomer.png'));
  saveCanvas(generateTank('soviet'), path.join(outDir, 'units/soviet_gattling_tank.png'));
  saveCanvas(generateMiner('soviet'), path.join(outDir, 'units/soviet_slave_miner.png'));
  saveCanvas(generateMCV('allied'), path.join(outDir, 'units/allied_mcv.png'));
  saveCanvas(generateMCV('soviet'), path.join(outDir, 'units/soviet_mcv.png'));

  // 新增RA2单位
  saveCanvas(generateDolphin(), path.join(outDir, 'units/allied_dolphin.png'));
  saveCanvas(generateSquid(), path.join(outDir, 'units/soviet_squid.png'));
  saveCanvas(generateCarrier(), path.join(outDir, 'units/allied_carrier.png'));
  saveCanvas(generateV3Rocket(), path.join(outDir, 'units/soviet_v3_rocket.png'));
  saveCanvas(generateChronoMiner('allied'), path.join(outDir, 'units/allied_chrono_miner.png'));
  saveCanvas(generateHarrier(), path.join(outDir, 'units/allied_harrier.png'));

  console.log('🏛️  生成建筑精灵图...');
  
  // 基础建筑
  saveCanvas(generateBuilding('command', 'allied'), path.join(outDir, 'buildings/allied_command.png'));
  saveCanvas(generateBuilding('command', 'soviet'), path.join(outDir, 'buildings/soviet_command.png'));
  saveCanvas(generateBuilding('barracks', 'allied'), path.join(outDir, 'buildings/allied_barracks.png'));
  saveCanvas(generateBuilding('barracks', 'soviet'), path.join(outDir, 'buildings/soviet_barracks.png'));
  saveCanvas(generateBuilding('refinery', 'allied'), path.join(outDir, 'buildings/allied_refinery.png'));
  saveCanvas(generateBuilding('refinery', 'soviet'), path.join(outDir, 'buildings/soviet_refinery.png'));
  saveCanvas(generateBuilding('warfactory', 'allied'), path.join(outDir, 'buildings/allied_warfactory.png'));
  saveCanvas(generateBuilding('warfactory', 'soviet'), path.join(outDir, 'buildings/soviet_warfactory.png'));
  
  // 新增建筑
  saveCanvas(generateBuilding('power', 'allied'), path.join(outDir, 'buildings/allied_power.png'));
  saveCanvas(generateBuilding('power', 'soviet'), path.join(outDir, 'buildings/soviet_power.png'));
  saveCanvas(generateBuilding('radar', 'allied'), path.join(outDir, 'buildings/allied_radar.png'));
  saveCanvas(generateBuilding('radar', 'soviet'), path.join(outDir, 'buildings/soviet_radar.png'));
  saveCanvas(generateBuilding('tech', 'allied'), path.join(outDir, 'buildings/allied_tech.png'));
  saveCanvas(generateBuilding('tech', 'soviet'), path.join(outDir, 'buildings/soviet_tech.png'));
  saveCanvas(generateBuilding('repair', 'allied'), path.join(outDir, 'buildings/allied_repair.png'));
  saveCanvas(generateBuilding('repair', 'soviet'), path.join(outDir, 'buildings/soviet_repair.png'));
  saveCanvas(generateBuilding('wall', 'allied'), path.join(outDir, 'buildings/allied_wall.png'));
  saveCanvas(generateBuilding('wall', 'soviet'), path.join(outDir, 'buildings/soviet_wall.png'));
  
  // 高级建筑
  saveCanvas(generateBuilding('airfield', 'allied'), path.join(outDir, 'buildings/allied_airfield.png'));
  saveCanvas(generateBuilding('airfield', 'soviet'), path.join(outDir, 'buildings/soviet_airfield.png'));
  saveCanvas(generateBuilding('defense', 'allied'), path.join(outDir, 'buildings/allied_defense.png'));
  saveCanvas(generateBuilding('defense', 'soviet'), path.join(outDir, 'buildings/soviet_defense.png'));
  saveCanvas(generateBuilding('teslacoil', 'soviet'), path.join(outDir, 'buildings/soviet_teslacoil.png'));
  saveCanvas(generateBuilding('turret', 'allied'), path.join(outDir, 'buildings/allied_turret.png'));
  saveCanvas(generateBuilding('flame_tower', 'soviet'), path.join(outDir, 'buildings/soviet_flame_tower.png'));
  saveCanvas(generateBuilding('helipad', 'allied'), path.join(outDir, 'buildings/allied_helipad.png'));
  saveCanvas(generateBuilding('helipad', 'soviet'), path.join(outDir, 'buildings/soviet_helipad.png'));
  saveCanvas(generateBuilding('nuclear_silo', 'soviet'), path.join(outDir, 'buildings/soviet_nuclear_silo.png'));
  saveCanvas(generateBuilding('iron_curtain', 'soviet'), path.join(outDir, 'buildings/soviet_iron_curtain.png'));
  saveCanvas(generateBuilding('chronosphere', 'allied'), path.join(outDir, 'buildings/allied_chronosphere.png'));
  saveCanvas(generateBuilding('naval_shipyard', 'allied'), path.join(outDir, 'buildings/allied_naval_shipyard.png'));
  saveCanvas(generateBuilding('naval_shipyard', 'soviet'), path.join(outDir, 'buildings/soviet_naval_shipyard.png'));
  saveCanvas(generateBuilding('oil_derrick', 'allied'), path.join(outDir, 'buildings/neutral_oil_derrick.png'));
  saveCanvas(generateBuilding('hospital', 'allied'), path.join(outDir, 'buildings/neutral_hospital.png'));

  // 新增建筑
  saveCanvas(generateBuilding('patriot', 'allied'), path.join(outDir, 'buildings/allied_patriot.png'));
  saveCanvas(generateBuilding('sentry_gun', 'soviet'), path.join(outDir, 'buildings/soviet_sentry_gun.png'));
  saveCanvas(generateBuilding('battle_bunker', 'soviet'), path.join(outDir, 'buildings/soviet_battle_bunker.png'));
  saveCanvas(generateBuilding('cloning_vats', 'soviet'), path.join(outDir, 'buildings/soviet_cloning_vats.png'));
  saveCanvas(generateBuilding('industrial_plant', 'soviet'), path.join(outDir, 'buildings/soviet_industrial_plant.png'));
  saveCanvas(generateBuilding('psychic_sensor', 'soviet'), path.join(outDir, 'buildings/soviet_psychic_sensor.png'));
  saveCanvas(generateBuilding('civilian_building', 'allied'), path.join(outDir, 'buildings/neutral_civilian_building.png'));
  saveCanvas(generateBuilding('biolab', 'allied'), path.join(outDir, 'buildings/neutral_biolab.png'));
  saveCanvas(generateBuilding('machine_shop', 'allied'), path.join(outDir, 'buildings/neutral_machine_shop.png'));
  saveCanvas(generateBuilding('bridge', 'allied'), path.join(outDir, 'buildings/neutral_bridge.png'));
  saveCanvas(generateBuilding('bridge_destroyed', 'allied'), path.join(outDir, 'buildings/neutral_bridge_destroyed.png'));

  // 新增RA2建筑
  saveCanvas(generateBuilding('gap_generator', 'allied'), path.join(outDir, 'buildings/allied_gap_generator.png'));
  saveCanvas(generateBuilding('nuclear_reactor', 'soviet'), path.join(outDir, 'buildings/soviet_nuclear_reactor.png'));
  saveCanvas(generateBuilding('flak_cannon', 'soviet'), path.join(outDir, 'buildings/soviet_flak_cannon.png'));
  saveCanvas(generateBuilding('spy_satellite', 'allied'), path.join(outDir, 'buildings/allied_spy_satellite.png'));
  saveCanvas(generateBuilding('ore_purifier', 'allied'), path.join(outDir, 'buildings/allied_ore_purifier.png'));
  saveCanvas(generateBuilding('grand_cannon', 'allied'), path.join(outDir, 'buildings/allied_grand_cannon.png'));

  console.log('\n✅ 完整精灵图集生成完成！');
  console.log('📍 文件位置: public/assets/sprites/');
  console.log('📊 单位: 32种 | 建筑: 52种 | 特效: ' + (FRAMES * 3) + '帧');
  console.log('🎮 请运行 npm run dev 查看效果');
}

main().catch(console.error);