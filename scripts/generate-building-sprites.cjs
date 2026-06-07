#!/usr/bin/env node
/**
 * 高质量红警2风格建筑精灵图生成器
 * 为全部 11+1 种建筑类型生成精致的 128x128 像素精灵
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// ─── 调色板 ───────────────────────────────────────────────────────
const PALETTE = {
  allied: {
    base:      [55, 100, 160],
    mid:       [74, 127, 181],
    light:     [100, 160, 215],
    highlight: [140, 195, 240],
    dark:      [35, 70, 120],
    shadow:    [20, 50, 90],
  },
  soviet: {
    base:      [120, 25, 25],
    mid:       [155, 38, 38],
    light:     [185, 55, 55],
    highlight: [220, 80, 80],
    dark:      [85, 18, 18],
    shadow:    [55, 10, 10],
  },
  metal: {
    light:   [180, 185, 190],
    mid:     [140, 145, 150],
    dark:    [95, 100, 105],
    shadow:  [60, 62, 65],
  },
  concrete: {
    light:   [165, 165, 160],
    mid:     [130, 130, 125],
    dark:    [90, 90, 85],
  },
  glass: [130, 210, 240],
  glassHL: [180, 235, 255],
  gold: [255, 210, 50],
  goldDark: [200, 160, 30],
  wood: [120, 80, 40],
  woodDark: [80, 55, 30],
  ore: [255, 180, 50],
  oreDark: [200, 130, 20],
  green: [60, 140, 60],
  greenDark: [35, 90, 35],
  electric: [80, 200, 255],
  electricBright: [160, 240, 255],
  red: [220, 50, 50],
  yellow: [255, 230, 80],
};

// ─── 辅助绘制函数 ─────────────────────────────────────────────────
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function darken(c, n) { return c.map(v => Math.max(0, v - n)); }
function lighten(c, n) { return c.map(v => Math.min(255, v + n)); }

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x, y, w, h);
}

function drawRectA(ctx, x, y, w, h, color, alpha) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(x, y, w, h);
}

function strokeRect(ctx, x, y, w, h, color, lw = 2) {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = lw;
  ctx.strokeRect(x + lw/2, y + lw/2, w - lw, h - lw);
}

function drawCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEllipse(ctx, cx, cy, rx, ry, color, alpha = 1) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2, color, lw = 2) {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawTriangle(ctx, x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

/** 给区域添加噪点纹理 */
function addNoise(ctx, x, y, w, h, intensity = 15, density = 0.3) {
  for (let py = y; py < y + h; py += 2) {
    for (let px = x; px < x + w; px += 2) {
      if (Math.random() < density) {
        const v = (Math.random() - 0.5) * intensity * 2;
        const a = 0.15 + Math.random() * 0.1;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }
}

/** 绘制亮面玻璃窗 */
function drawWindow(ctx, x, y, w, h) {
  drawRect(ctx, x, y, w, h, PALETTE.glass);
  // 高光
  drawRect(ctx, x + 1, y + 1, Math.floor(w/2), Math.floor(h/2), PALETTE.glassHL);
  // 窗框
  ctx.strokeStyle = rgb(PALETTE.metal.dark);
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

/** 绘制伪等距盒子（顶面+正面+侧面） */
function drawIsoBox(ctx, x, y, w, h, depth, topColor, frontColor, sideColor) {
  // 正面
  drawRect(ctx, x, y, w, h, frontColor);
  // 顶面（梯形简化为矩形偏移）
  const topH = depth;
  drawRect(ctx, x, y - topH, w, topH, topColor);
  // 右侧面
  const sideW = Math.floor(depth * 0.6);
  drawRect(ctx, x + w, y - topH, sideW, h + topH, sideColor);
}

/** 绘制地面阴影 */
function drawGroundShadow(ctx, cx, cy, rx, ry) {
  drawEllipse(ctx, cx, cy, rx, ry, [0, 0, 0], 0.2);
}

// ─── 建筑绘制函数 ─────────────────────────────────────────────────

function drawCommand(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 52, 14);
  
  // 主体
  drawRect(ctx, 14, 38, 100, 66, colors.mid);
  drawRect(ctx, 16, 40, 96, 62, colors.base);
  addNoise(ctx, 16, 40, 96, 62, 12, 0.25);
  
  // 屋顶坡面
  drawRect(ctx, 12, 34, 104, 8, colors.light);
  drawRect(ctx, 12, 34, 104, 3, colors.highlight);
  
  // 二层建筑
  drawRect(ctx, 36, 14, 56, 24, colors.mid);
  drawRect(ctx, 38, 16, 52, 20, colors.dark);
  addNoise(ctx, 38, 16, 52, 20, 10, 0.2);
  
  // 雷达球顶
  drawCircle(ctx, 64, 12, 10, PALETTE.metal.light);
  drawCircle(ctx, 64, 12, 7, PALETTE.metal.mid);
  drawCircle(ctx, 61, 9, 3, PALETTE.metal.light); // 高光
  
  // 天线
  drawLine(ctx, 64, 2, 64, 6, PALETTE.metal.dark, 2);
  drawCircle(ctx, 64, 2, 2, PALETTE.gold);
  
  // 窗户组
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      drawWindow(ctx, 22 + col * 15, 48 + row * 16, 8, 8);
    }
  }
  
  // 大门
  drawRect(ctx, 50, 82, 28, 22, PALETTE.metal.dark);
  drawRect(ctx, 52, 84, 24, 18, PALETTE.metal.mid);
  drawRect(ctx, 63, 84, 2, 18, PALETTE.metal.dark);
  
  // 阵营标志
  drawCircle(ctx, 64, 26, 5, PALETTE.gold);
  
  // 外描边
  strokeRect(ctx, 14, 38, 100, 66, colors.shadow, 2);
}

function drawBarracks(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 50, 13);
  
  // 主体 - 长条营房
  drawRect(ctx, 12, 44, 104, 58, colors.mid);
  drawRect(ctx, 14, 46, 100, 54, colors.base);
  addNoise(ctx, 14, 46, 100, 54, 12, 0.25);
  
  // 屋顶
  drawTriangle(ctx, 10, 44, 64, 28, 118, 44, colors.light);
  drawRect(ctx, 10, 42, 108, 4, colors.highlight);
  
  // 烟囱
  drawRect(ctx, 95, 22, 10, 22, PALETTE.concrete.dark);
  drawRect(ctx, 93, 20, 14, 4, PALETTE.concrete.mid);
  // 烟
  drawEllipse(ctx, 100, 16, 5, 4, [150, 150, 150], 0.4);
  
  // 窗户
  for (let i = 0; i < 4; i++) {
    drawWindow(ctx, 20 + i * 22, 54, 10, 12);
  }
  
  // 大铁门
  drawRect(ctx, 44, 74, 40, 28, PALETTE.metal.dark);
  drawRect(ctx, 46, 76, 36, 24, PALETTE.metal.mid);
  // 门轨道
  for (let i = 0; i < 6; i++) {
    drawRect(ctx, 46, 76 + i * 4, 36, 1, PALETTE.metal.dark);
  }
  
  // 旗帜
  drawLine(ctx, 108, 44, 108, 18, PALETTE.metal.dark, 2);
  drawRect(ctx, 108, 18, 14, 10, colors.light);
  drawRect(ctx, 108, 18, 14, 4, colors.highlight);
  
  // 训练靶标
  drawCircle(ctx, 22, 88, 6, [255, 255, 255]);
  drawCircle(ctx, 22, 88, 4, PALETTE.red);
  drawCircle(ctx, 22, 88, 2, [255, 255, 255]);
  
  strokeRect(ctx, 12, 44, 104, 58, colors.shadow, 2);
}

function drawRefinery(ctx, colors) {
  drawGroundShadow(ctx, 64, 110, 54, 14);
  
  // 主厂房
  drawRect(ctx, 10, 48, 108, 56, colors.mid);
  drawRect(ctx, 12, 50, 104, 52, colors.base);
  addNoise(ctx, 12, 50, 104, 52, 10, 0.3);
  
  // 屋顶
  drawRect(ctx, 8, 44, 112, 8, colors.light);
  drawRect(ctx, 8, 44, 112, 3, colors.highlight);
  
  // 矿仓（大圆柱）
  drawRect(ctx, 20, 20, 40, 28, PALETTE.ore);
  drawRect(ctx, 22, 22, 36, 24, PALETTE.oreDark);
  drawEllipse(ctx, 40, 20, 20, 6, PALETTE.ore);
  addNoise(ctx, 20, 20, 40, 28, 20, 0.3);
  
  // 第二矿仓
  drawRect(ctx, 68, 25, 30, 22, PALETTE.ore);
  drawRect(ctx, 70, 27, 26, 18, PALETTE.oreDark);
  drawEllipse(ctx, 83, 25, 15, 5, PALETTE.ore);
  
  // 管道
  drawLine(ctx, 60, 34, 68, 34, PALETTE.metal.mid, 4);
  drawLine(ctx, 98, 36, 108, 50, PALETTE.metal.mid, 3);
  
  // 传送带/卸料口
  drawRect(ctx, 35, 88, 58, 16, PALETTE.metal.dark);
  drawRect(ctx, 37, 90, 54, 12, PALETTE.metal.shadow);
  for (let i = 0; i < 7; i++) {
    drawRect(ctx, 39 + i * 7, 90, 4, 12, PALETTE.metal.dark);
  }
  
  // 窗户
  drawWindow(ctx, 16, 58, 10, 10);
  drawWindow(ctx, 102, 58, 10, 10);
  
  // $符号
  ctx.fillStyle = rgb(PALETTE.gold);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('$', 58, 38);
  
  strokeRect(ctx, 10, 48, 108, 56, colors.shadow, 2);
}

function drawWarfactory(ctx, colors) {
  drawGroundShadow(ctx, 64, 112, 56, 15);
  
  // 巨大厂房
  drawRect(ctx, 6, 36, 116, 70, colors.mid);
  drawRect(ctx, 8, 38, 112, 66, colors.base);
  addNoise(ctx, 8, 38, 112, 66, 12, 0.3);
  
  // 屋顶（弧顶）
  drawRect(ctx, 4, 32, 120, 8, colors.light);
  drawRect(ctx, 4, 32, 120, 3, colors.highlight);
  
  // 大型滑轨门
  drawRect(ctx, 22, 56, 84, 50, PALETTE.metal.dark);
  drawRect(ctx, 24, 58, 80, 46, PALETTE.metal.mid);
  // 门板纹路
  for (let i = 0; i < 10; i++) {
    drawRect(ctx, 24, 58 + i * 5, 80, 1, PALETTE.metal.dark);
  }
  // 门轨
  drawRect(ctx, 18, 56, 6, 50, PALETTE.metal.shadow);
  drawRect(ctx, 104, 56, 6, 50, PALETTE.metal.shadow);
  
  // 吊车
  drawLine(ctx, 30, 32, 30, 18, PALETTE.metal.dark, 3);
  drawLine(ctx, 30, 18, 90, 18, PALETTE.metal.mid, 4);
  drawLine(ctx, 90, 18, 90, 32, PALETTE.metal.dark, 3);
  // 吊钩
  drawLine(ctx, 60, 18, 60, 28, PALETTE.gold, 2);
  drawTriangle(ctx, 56, 28, 64, 28, 60, 34, PALETTE.goldDark);
  
  // 烟囱
  drawRect(ctx, 100, 14, 12, 22, PALETTE.concrete.dark);
  drawRect(ctx, 98, 12, 16, 4, PALETTE.concrete.mid);
  
  // 侧窗
  drawWindow(ctx, 10, 42, 8, 10);
  drawWindow(ctx, 110, 42, 8, 10);
  
  // 警示条纹
  for (let i = 0; i < 5; i++) {
    drawRect(ctx, 24 + i * 16, 100, 8, 4, PALETTE.yellow);
  }
  
  strokeRect(ctx, 6, 36, 116, 70, colors.shadow, 2);
}

function drawPower(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 50, 13);
  
  // 主建筑
  drawRect(ctx, 18, 50, 92, 52, colors.mid);
  drawRect(ctx, 20, 52, 88, 48, colors.base);
  addNoise(ctx, 20, 52, 88, 48, 10, 0.25);
  
  // 屋顶
  drawRect(ctx, 16, 46, 96, 6, colors.light);
  
  // 冷却塔（梯形）
  ctx.fillStyle = rgb(PALETTE.concrete.mid);
  ctx.beginPath();
  ctx.moveTo(30, 46);
  ctx.lineTo(24, 18);
  ctx.lineTo(50, 18);
  ctx.lineTo(44, 46);
  ctx.closePath();
  ctx.fill();
  // 塔顶蒸汽
  drawEllipse(ctx, 37, 14, 10, 5, [200, 200, 210], 0.5);
  
  // 第二冷却塔
  ctx.fillStyle = rgb(PALETTE.concrete.mid);
  ctx.beginPath();
  ctx.moveTo(78, 46);
  ctx.lineTo(72, 22);
  ctx.lineTo(96, 22);
  ctx.lineTo(90, 46);
  ctx.closePath();
  ctx.fill();
  drawEllipse(ctx, 84, 18, 9, 4, [200, 200, 210], 0.4);
  
  // 电线
  drawLine(ctx, 16, 50, 6, 30, PALETTE.metal.dark, 2);
  drawLine(ctx, 112, 50, 122, 30, PALETTE.metal.dark, 2);
  // 绝缘子
  drawCircle(ctx, 6, 30, 3, PALETTE.electric);
  drawCircle(ctx, 122, 30, 3, PALETTE.electric);
  
  // 闪电标志
  ctx.fillStyle = rgb(PALETTE.yellow);
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.lineTo(66, 60);
  ctx.lineTo(62, 70);
  ctx.lineTo(68, 70);
  ctx.lineTo(58, 84);
  ctx.lineTo(62, 74);
  ctx.lineTo(56, 74);
  ctx.closePath();
  ctx.fill();
  
  // 窗户
  drawWindow(ctx, 24, 72, 10, 12);
  drawWindow(ctx, 94, 72, 10, 12);
  
  strokeRect(ctx, 18, 50, 92, 52, colors.shadow, 2);
}

function drawRadar(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 46, 12);
  
  // 基座建筑
  drawRect(ctx, 28, 64, 72, 40, colors.mid);
  drawRect(ctx, 30, 66, 68, 36, colors.base);
  addNoise(ctx, 30, 66, 68, 36, 10, 0.2);
  
  // 屋顶
  drawRect(ctx, 26, 60, 76, 6, colors.light);
  
  // 雷达塔柱
  drawRect(ctx, 58, 24, 12, 40, PALETTE.metal.mid);
  drawRect(ctx, 56, 22, 16, 4, PALETTE.metal.light);
  
  // 大型雷达碟
  ctx.fillStyle = rgb(PALETTE.metal.light);
  ctx.beginPath();
  ctx.ellipse(64, 20, 32, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgb(PALETTE.metal.mid);
  ctx.beginPath();
  ctx.ellipse(64, 20, 28, 12, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // 碟面纹路
  for (let i = 0; i < 4; i++) {
    drawLine(ctx, 64, 20, 40 + i * 14, 8, PALETTE.metal.dark, 1);
  }
  // 中心接收器
  drawCircle(ctx, 64, 16, 4, PALETTE.green);
  drawCircle(ctx, 64, 16, 2, [100, 255, 100]);
  
  // 侧面天线
  drawLine(ctx, 30, 60, 20, 40, PALETTE.metal.dark, 2);
  drawLine(ctx, 98, 60, 108, 40, PALETTE.metal.dark, 2);
  drawCircle(ctx, 20, 40, 3, PALETTE.electric);
  drawCircle(ctx, 108, 40, 3, PALETTE.electric);
  
  // 窗户
  drawWindow(ctx, 38, 74, 10, 12);
  drawWindow(ctx, 80, 74, 10, 12);
  
  // 指示灯
  drawCircle(ctx, 64, 80, 3, PALETTE.green);
  
  strokeRect(ctx, 28, 64, 72, 40, colors.shadow, 2);
}

function drawTech(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 48, 13);
  
  // 主体（现代风格）
  drawRect(ctx, 16, 42, 96, 62, colors.mid);
  drawRect(ctx, 18, 44, 92, 58, colors.base);
  addNoise(ctx, 18, 44, 92, 58, 8, 0.2);
  
  // 玻璃顶
  drawRect(ctx, 14, 36, 100, 8, PALETTE.glass);
  drawRect(ctx, 14, 36, 100, 3, PALETTE.glassHL);
  // 玻璃顶支架
  for (let i = 0; i < 6; i++) {
    drawLine(ctx, 20 + i * 18, 36, 20 + i * 18, 44, PALETTE.metal.dark, 1);
  }
  
  // 实验室圆顶
  ctx.fillStyle = rgb(PALETTE.glass);
  ctx.beginPath();
  ctx.arc(64, 36, 18, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = rgb(PALETTE.glassHL);
  ctx.beginPath();
  ctx.arc(64, 36, 14, Math.PI, Math.PI * 1.6);
  ctx.fill();
  
  // 激光发射器
  drawRect(ctx, 60, 12, 8, 12, PALETTE.metal.mid);
  drawCircle(ctx, 64, 10, 5, PALETTE.electric);
  drawCircle(ctx, 64, 10, 3, PALETTE.electricBright);
  
  // 大型窗户（玻璃幕墙）
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      drawWindow(ctx, 22 + col * 18, 50 + row * 16, 12, 10);
    }
  }
  
  // 科技符号
  drawCircle(ctx, 64, 98, 6, PALETTE.electric);
  ctx.strokeStyle = rgb(PALETTE.electricBright);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 98, 9, 0, Math.PI * 2);
  ctx.stroke();
  
  strokeRect(ctx, 16, 42, 96, 62, colors.shadow, 2);
}

function drawRepair(ctx, colors) {
  drawGroundShadow(ctx, 64, 110, 52, 14);
  
  // 维修坞（U形）
  drawRect(ctx, 10, 48, 108, 58, colors.mid);
  drawRect(ctx, 12, 50, 104, 54, colors.base);
  addNoise(ctx, 12, 50, 104, 54, 10, 0.25);
  
  // 开口部分
  drawRect(ctx, 30, 74, 68, 34, PALETTE.concrete.dark);
  drawRect(ctx, 32, 76, 64, 30, PALETTE.concrete.mid);
  
  // 机械臂（左）
  drawLine(ctx, 24, 48, 24, 28, PALETTE.metal.dark, 4);
  drawLine(ctx, 24, 28, 50, 28, PALETTE.metal.mid, 3);
  drawLine(ctx, 50, 28, 50, 40, PALETTE.metal.dark, 2);
  // 夹爪
  drawLine(ctx, 47, 40, 44, 46, PALETTE.gold, 2);
  drawLine(ctx, 53, 40, 56, 46, PALETTE.gold, 2);
  
  // 机械臂（右）
  drawLine(ctx, 104, 48, 104, 32, PALETTE.metal.dark, 4);
  drawLine(ctx, 104, 32, 80, 32, PALETTE.metal.mid, 3);
  drawLine(ctx, 80, 32, 80, 42, PALETTE.metal.dark, 2);
  drawLine(ctx, 77, 42, 74, 48, PALETTE.gold, 2);
  drawLine(ctx, 83, 42, 86, 48, PALETTE.gold, 2);
  
  // 屋顶
  drawRect(ctx, 8, 44, 112, 6, colors.light);
  
  // 扳手标志
  ctx.strokeStyle = rgb(PALETTE.yellow);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(64, 86, 8, 0.3, Math.PI * 2 - 0.3);
  ctx.stroke();
  drawCircle(ctx, 64, 86, 3, PALETTE.yellow);
  
  // 侧窗
  drawWindow(ctx, 14, 56, 10, 10);
  drawWindow(ctx, 104, 56, 10, 10);
  
  strokeRect(ctx, 10, 48, 108, 58, colors.shadow, 2);
}

function drawWall(ctx, colors) {
  // 墙段无大阴影
  drawGroundShadow(ctx, 64, 105, 40, 8);
  
  // 墙体
  drawRect(ctx, 20, 55, 88, 40, colors.mid);
  drawRect(ctx, 22, 57, 84, 36, colors.base);
  addNoise(ctx, 22, 57, 84, 36, 15, 0.35);
  
  // 墙顶
  drawRect(ctx, 18, 52, 92, 5, colors.light);
  
  // 砖纹
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : 10;
    for (let col = 0; col < 5; col++) {
      ctx.strokeStyle = rgba(colors.dark, 0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(22 + offset + col * 17, 58 + row * 9, 16, 8);
    }
  }
  
  // 铁丝网顶部
  ctx.strokeStyle = rgb(PALETTE.metal.dark);
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const x = 24 + i * 11;
    drawLine(ctx, x, 52, x, 44, PALETTE.metal.dark, 1);
  }
  // 横丝
  drawLine(ctx, 24, 46, 108, 46, PALETTE.metal.mid, 1);
  drawLine(ctx, 24, 49, 108, 49, PALETTE.metal.mid, 1);
  // 交叉丝
  for (let i = 0; i < 7; i++) {
    const x = 24 + i * 11;
    drawLine(ctx, x, 44, x + 11, 52, PALETTE.metal.dark, 1);
    drawLine(ctx, x + 11, 44, x, 52, PALETTE.metal.dark, 1);
  }
  
  // 门柱
  drawRect(ctx, 18, 52, 6, 43, colors.dark);
  drawRect(ctx, 104, 52, 6, 43, colors.dark);
}

function drawAirfield(ctx, colors) {
  drawGroundShadow(ctx, 64, 110, 54, 14);
  
  // 停机坪（混凝土地面）
  drawRect(ctx, 8, 55, 112, 52, PALETTE.concrete.mid);
  drawRect(ctx, 10, 57, 108, 48, PALETTE.concrete.light);
  addNoise(ctx, 10, 57, 108, 48, 8, 0.3);
  
  // 跑道标记
  for (let i = 0; i < 5; i++) {
    drawRect(ctx, 24 + i * 18, 96, 10, 3, PALETTE.yellow);
  }
  // H标记
  drawRect(ctx, 52, 68, 4, 20, [255, 255, 255]);
  drawRect(ctx, 72, 68, 4, 20, [255, 255, 255]);
  drawRect(ctx, 52, 76, 24, 4, [255, 255, 255]);
  
  // 控制塔
  drawRect(ctx, 88, 20, 26, 38, colors.mid);
  drawRect(ctx, 90, 22, 22, 34, colors.base);
  addNoise(ctx, 90, 22, 22, 34, 10, 0.2);
  // 塔顶（玻璃观察层）
  drawRect(ctx, 86, 14, 30, 8, PALETTE.glass);
  drawRect(ctx, 86, 14, 30, 3, PALETTE.glassHL);
  // 天线
  drawLine(ctx, 101, 14, 101, 4, PALETTE.metal.dark, 2);
  drawCircle(ctx, 101, 4, 2, PALETTE.red);
  
  // 机库
  drawRect(ctx, 8, 36, 50, 22, colors.dark);
  drawRect(ctx, 10, 38, 46, 18, colors.mid);
  // 机库门
  drawRect(ctx, 14, 44, 38, 12, PALETTE.metal.dark);
  
  strokeRect(ctx, 8, 55, 112, 52, colors.shadow, 1);
}

function drawDefense(ctx, colors) {
  drawGroundShadow(ctx, 64, 108, 36, 10);
  
  // 碉堡基座（八角形简化为方形+削角）
  drawRect(ctx, 28, 56, 72, 48, colors.dark);
  drawRect(ctx, 30, 58, 68, 44, colors.mid);
  addNoise(ctx, 30, 58, 68, 44, 15, 0.3);
  
  // 顶部装甲平台
  drawRect(ctx, 24, 50, 80, 8, colors.light);
  drawRect(ctx, 24, 50, 80, 3, colors.highlight);
  
  // 炮塔底座
  drawCircle(ctx, 64, 44, 18, PALETTE.metal.dark);
  drawCircle(ctx, 64, 44, 15, PALETTE.metal.mid);
  drawCircle(ctx, 64, 44, 12, PALETTE.metal.light);
  
  // 炮管
  drawRect(ctx, 62, 16, 4, 28, PALETTE.metal.dark);
  drawRect(ctx, 60, 14, 8, 4, PALETTE.metal.shadow);
  // 炮口闪光装饰
  drawCircle(ctx, 64, 13, 3, PALETTE.yellow);
  
  // 射击孔
  drawRect(ctx, 36, 70, 8, 4, [20, 20, 20]);
  drawRect(ctx, 56, 70, 8, 4, [20, 20, 20]);
  drawRect(ctx, 76, 70, 8, 4, [20, 20, 20]);
  drawRect(ctx, 36, 86, 8, 4, [20, 20, 20]);
  drawRect(ctx, 76, 86, 8, 4, [20, 20, 20]);
  
  // 装甲铆钉
  const rivets = [[32, 60], [92, 60], [32, 96], [92, 96]];
  rivets.forEach(([rx, ry]) => drawCircle(ctx, rx, ry, 2, PALETTE.metal.shadow));
  
  strokeRect(ctx, 28, 56, 72, 48, colors.shadow, 2);
}

function drawTeslaCoil(ctx, colors) {
  drawGroundShadow(ctx, 64, 110, 40, 11);
  
  // 基座
  drawRect(ctx, 34, 74, 60, 32, colors.mid);
  drawRect(ctx, 36, 76, 56, 28, colors.base);
  addNoise(ctx, 36, 76, 56, 28, 12, 0.25);
  strokeRect(ctx, 34, 74, 60, 32, colors.shadow, 2);
  
  // 线圈塔柱
  drawRect(ctx, 56, 20, 16, 56, PALETTE.metal.dark);
  drawRect(ctx, 58, 22, 12, 52, PALETTE.metal.mid);
  
  // 线圈环
  for (let i = 0; i < 6; i++) {
    const y = 28 + i * 8;
    const w = 24 + (6 - i) * 2;
    drawRect(ctx, 64 - w/2, y, w, 3, PALETTE.electric);
  }
  
  // 顶部球体
  drawCircle(ctx, 64, 18, 14, PALETTE.metal.light);
  drawCircle(ctx, 64, 18, 11, PALETTE.metal.mid);
  // 电弧高光
  drawCircle(ctx, 59, 14, 4, [200, 220, 240]);
  
  // 电弧效果
  ctx.strokeStyle = rgb(PALETTE.electric);
  ctx.lineWidth = 2;
  // 左电弧
  ctx.beginPath();
  ctx.moveTo(52, 18);
  ctx.quadraticCurveTo(40, 10, 30, 20);
  ctx.quadraticCurveTo(26, 28, 34, 38);
  ctx.stroke();
  // 右电弧
  ctx.beginPath();
  ctx.moveTo(76, 18);
  ctx.quadraticCurveTo(88, 8, 96, 18);
  ctx.quadraticCurveTo(100, 28, 92, 36);
  ctx.stroke();
  
  // 底部电气设备
  drawRect(ctx, 40, 96, 12, 8, PALETTE.metal.dark);
  drawRect(ctx, 76, 96, 12, 8, PALETTE.metal.dark);
  drawCircle(ctx, 46, 100, 3, PALETTE.electric);
  drawCircle(ctx, 82, 100, 3, PALETTE.electric);
  
  // 危险标志
  drawTriangle(ctx, 64, 82, 56, 94, 72, 94, PALETTE.yellow);
  ctx.fillStyle = rgb([0, 0, 0]);
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡', 64, 92);
  ctx.textAlign = 'left';
}

// ─── 主生成逻辑 ───────────────────────────────────────────────────

const BUILDING_TYPES = [
  'command', 'barracks', 'refinery', 'warfactory',
  'power', 'radar', 'tech', 'repair',
  'wall', 'airfield', 'defense'
];

const DRAW_FUNCTIONS = {
  command: drawCommand,
  barracks: drawBarracks,
  refinery: drawRefinery,
  warfactory: drawWarfactory,
  power: drawPower,
  radar: drawRadar,
  tech: drawTech,
  repair: drawRepair,
  wall: drawWall,
  airfield: drawAirfield,
  defense: drawDefense,
  teslacoil: drawTeslaCoil,
};

function generateBuilding(type, faction) {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 128, 128);
  
  const colors = faction === 'allied' ? PALETTE.allied : PALETTE.soviet;
  const drawFn = DRAW_FUNCTIONS[type];
  
  if (drawFn) {
    drawFn(ctx, colors);
  } else {
    // 未知类型的回退
    drawGroundShadow(ctx, 64, 100, 40, 10);
    drawRect(ctx, 24, 40, 80, 60, colors.mid);
    strokeRect(ctx, 24, 40, 80, 60, colors.shadow, 2);
  }
  
  return canvas;
}

function saveCanvas(canvas, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);
  console.log(`  生成: ${path.basename(filepath)} (${(buffer.length / 1024).toFixed(1)}KB)`);
}

function main() {
  console.log('=== 建筑精灵图生成器 ===\n');
  
  const outDir = path.join(__dirname, '../public/assets/sprites/buildings');
  
  // 盟军建筑
  console.log('盟军建筑 (Allied):');
  for (const type of BUILDING_TYPES) {
    const canvas = generateBuilding(type, 'allied');
    saveCanvas(canvas, path.join(outDir, `allied_${type}.png`));
  }
  
  // 苏军建筑
  console.log('\n苏军建筑 (Soviet):');
  for (const type of BUILDING_TYPES) {
    const canvas = generateBuilding(type, 'soviet');
    saveCanvas(canvas, path.join(outDir, `soviet_${type}.png`));
  }
  // 特斯拉线圈（苏联独有）
  const teslaCanvas = generateBuilding('teslacoil', 'soviet');
  saveCanvas(teslaCanvas, path.join(outDir, 'soviet_teslacoil.png'));
  
  console.log(`\n完成! 共生成 ${BUILDING_TYPES.length * 2 + 1} 个建筑精灵文件`);
  console.log(`输出目录: ${outDir}`);
}

main();
