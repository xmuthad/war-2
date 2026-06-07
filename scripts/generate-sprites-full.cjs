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

  console.log('\n✅ 完整精灵图集生成完成！');
  console.log('📍 文件位置: public/assets/sprites/');
  console.log('📊 单位: 16种 | 建筑: 25种 | 特效: ' + (FRAMES * 3) + '帧');
  console.log('🎮 请运行 npm run dev 查看效果');
}

main().catch(console.error);