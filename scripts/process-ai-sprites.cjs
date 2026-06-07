#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * AI生成精灵图后处理工具
 * 功能：
 * 1. 调整透明度
 * 2. 对齐网格
 * 3. 像素化处理
 * 4. 去除噪点
 * 5. 调整尺寸
 */

const INPUT_DIR = path.join(__dirname, '../ai-sprites');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/sprites');

// 精灵图配置
const CONFIG = {
  unit: {
    frameWidth: 64,
    frameHeight: 64,
    directions: 8,
    framesPerDirection: 4
  },
  building: {
    width: 128,
    height: 128
  }
};

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 处理单个精灵图
async function processSprite(inputPath, outputPath, type) {
  console.log(`处理: ${path.basename(inputPath)}`);
  
  const img = await loadImage(inputPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  
  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // 像素化处理
  pixelate(data, canvas.width, canvas.height);
  
  // 优化透明度
  optimizeAlpha(data);
  
  // 去噪
  denoise(data, canvas.width, canvas.height);
  
  ctx.putImageData(imageData, 0, 0);
  
  // 如果是单位，可能需要重新排列网格
  if (type === 'unit') {
    const processed = reorganizeSpriteSheet(canvas);
    const buffer = processed.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
  } else {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
  }
  
  console.log(`✓ 保存到: ${outputPath}`);
}

// 像素化处理
function pixelate(data, width, height, pixelSize = 2) {
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      // 获取区域平均颜色
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      
      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }
      
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      
      // 应用到整个块
      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }
}

// 优化透明度
function optimizeAlpha(data, threshold = 50) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < threshold) {
      data[i + 3] = 0; // 完全透明
    } else {
      data[i + 3] = 255; // 完全不透明
    }
  }
}

// 去噪处理
function denoise(data, width, height) {
  const original = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      if (data[idx + 3] === 0) continue; // 跳过透明像素
      
      // 检查周围像素
      let transparentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          if (original[nIdx + 3] === 0) {
            transparentNeighbors++;
          }
        }
      }
      
      // 如果周围大部分是透明的，去除这个噪点
      if (transparentNeighbors >= 6) {
        data[idx + 3] = 0;
      }
    }
  }
}

// 重新排列精灵图网格
function reorganizeSpriteSheet(canvas) {
  const frameW = CONFIG.unit.frameWidth;
  const frameH = CONFIG.unit.frameHeight;
  const totalW = frameW * CONFIG.unit.framesPerDirection;
  const totalH = frameH * CONFIG.unit.directions;
  
  const output = createCanvas(totalW, totalH);
  const ctx = output.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  // 填充背景透明
  ctx.clearRect(0, 0, totalW, totalH);
  
  // 计算如何从输入中提取帧
  const srcCols = Math.floor(canvas.width / frameW);
  const srcRows = Math.floor(canvas.height / frameH);
  
  let frameCount = 0;
  
  for (let dir = 0; dir < CONFIG.unit.directions; dir++) {
    for (let frame = 0; frame < CONFIG.unit.framesPerDirection; frame++) {
      const srcX = (frameCount % srcCols) * frameW;
      const srcY = Math.floor(frameCount / srcCols) * frameH;
      
      const dstX = frame * frameW;
      const dstY = dir * frameH;
      
      if (srcX + frameW <= canvas.width && srcY + frameH <= canvas.height) {
        ctx.drawImage(canvas, srcX, srcY, frameW, frameH, dstX, dstY, frameW, frameH);
      }
      
      frameCount++;
      if (frameCount >= srcCols * srcRows) break;
    }
  }
  
  return output;
}

// 批量处理
async function processAll() {
  ensureDir(INPUT_DIR);
  ensureDir(path.join(OUTPUT_DIR, 'units'));
  ensureDir(path.join(OUTPUT_DIR, 'buildings'));
  
  const files = fs.readdirSync(INPUT_DIR);
  const imageFiles = files.filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
  
  if (imageFiles.length === 0) {
    console.log('在 ai-sprites/ 目录中没有找到图片文件');
    console.log('请将AI生成的精灵图放入该目录');
    console.log();
    console.log('示例:');
    console.log('  ai-sprites/allied-soldier.png');
    console.log('  ai-sprites/soviet-tank.png');
    console.log('  ai-sprites/allied-command.png');
    return;
  }
  
  console.log(`找到 ${imageFiles.length} 个文件\n`);
  
  for (const file of imageFiles) {
    const inputPath = path.join(INPUT_DIR, file);
    
    // 自动识别类型
    let type = 'unit';
    let outputSubdir = 'units';
    let outputName = file.toLowerCase().replace(/[_\-\s]+/g, '_');
    
    if (file.toLowerCase().includes('command') || 
        file.toLowerCase().includes('barracks') ||
        file.toLowerCase().includes('refinery') ||
        file.toLowerCase().includes('power') ||
        file.toLowerCase().includes('warfactory') ||
        file.toLowerCase().includes('building')) {
      type = 'building';
      outputSubdir = 'buildings';
    }
    
    const outputPath = path.join(OUTPUT_DIR, outputSubdir, outputName);
    
    try {
      await processSprite(inputPath, outputPath, type);
    } catch (err) {
      console.error(`✗ 处理失败 ${file}: ${err.message}`);
    }
  }
  
  console.log('\n✓ 全部处理完成!');
}

// 手动转换单个文件
function singleFileMode() {
  console.log('单文件处理模式:');
  console.log('node process-ai-sprites.cjs <input.png> <output.png> [unit|building]');
}

// 主函数
async function main() {
  console.log('=== AI精灵图后处理工具 ===\n');
  
  if (process.argv.length > 2) {
    singleFileMode();
  } else {
    await processAll();
  }
}

main().catch(console.error);
