#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

/**
 * 红警2精灵图设置脚本
 * 由于版权原因，我们无法直接提供红警2精灵图
 * 这个脚本会：
 * 1. 检查是否有红警2游戏文件
 * 2. 如果没有，提供替代方案
 */

const SPRITES_DIR = path.join(__dirname, '../public/assets/sprites');
const TOOLS_DIR = path.join(__dirname, '../tools');

// 红警2精灵图文件映射
const RA2_SPRITE_MAPPING = {
  units: {
    'allied_soldier.png': 'gi.shp',      // 美国大兵
    'soviet_soldier.png': 'e1.shp',       // 动员兵
    'allied_tank.png': 'htnk.shp',        // 灰熊坦克
    'soviet_tank.png': 'mtnk.shp',        // 犀牛坦克
    'allied_ifv.png': 'fv.shp',           // 多功能步兵车
    'soviet_apocalypse.png': 'apoc.shp',  // 天启坦克
    'allied_prism.png': 'sref.shp',       // 光棱坦克
    'soviet_tesla.png': 'ttnk.shp',       // 磁能坦克
  },
  buildings: {
    'allied_command.png': 'gacnst.shp',   // 盟军建造厂
    'soviet_command.png': 'nacnst.shp',   // 苏军建造厂
    'allied_barracks.png': 'gapile.shp',  // 盟军兵营
    'soviet_barracks.png': 'napile.shp',  // 苏军兵营
    'allied_refinery.png': 'garefn.shp',  // 盟军矿厂
    'soviet_refinery.png': 'narefn.shp',  // 苏军矿厂
    'allied_warfactory.png': 'gaweap.shp', // 盟军战车工厂
    'soviet_warfactory.png': 'naweap.shp', // 苏军战车工厂
  }
};

// 检查是否有红警2游戏文件
function checkRA2Installation() {
  const possiblePaths = [
    '/Applications/Red Alert 2',
    '/Applications/Command & Conquer Red Alert 2',
    path.join(process.env.HOME, 'Games/Red Alert 2'),
    path.join(process.env.HOME, '.wine/drive_c/Program Files/EA Games/Command & Conquer Red Alert 2'),
    'C:\\Program Files\\EA Games\\Command & Conquer Red Alert 2',
    'C:\\Program Files (x86)\\EA Games\\Command & Conquer Red Alert 2',
  ];

  for (const gamePath of possiblePaths) {
    if (fs.existsSync(gamePath)) {
      console.log(`找到红警2安装目录: ${gamePath}`);
      return gamePath;
    }
  }

  return null;
}

// 检查是否有 .mix 文件
function findMixFiles(gamePath) {
  const mixFiles = [];
  
  function searchDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          searchDir(fullPath);
        } else if (file.endsWith('.mix')) {
          mixFiles.push(fullPath);
        }
      }
    } catch (e) {
      // 忽略权限错误
    }
  }

  searchDir(gamePath);
  return mixFiles;
}

// 创建SHP转换工具
function createSHPConverter() {
  const converterPath = path.join(TOOLS_DIR, 'shp-to-png.py');
  
  const converterCode = `
#!/usr/bin/env python3
"""
SHP to PNG converter for Red Alert 2 sprites
Requires: pip install pillow numpy
"""

import sys
import struct
from PIL import Image
import numpy as np

def read_shp(filename):
    """Read SHP file and return list of frames"""
    with open(filename, 'rb') as f:
        # Read header
        header = f.read(14)
        count = struct.unpack('<H', header[0:2])[0]
        x = struct.unpack('<H', header[2:4])[0]
        y = struct.unpack('<H', header[4:6])[0]
        width = struct.unpack('<H', header[6:8])[0]
        height = struct.unpack('<H', header[8:10])[0]
        
        print(f"SHP Info: {count} frames, {width}x{height}")
        
        frames = []
        
        for i in range(count):
            # Read frame header
            frame_header = f.read(24)
            frame_x = struct.unpack('<H', frame_header[0:2])[0]
            frame_y = struct.unpack('<H', frame_header[2:4])[0]
            frame_width = struct.unpack('<H', frame_header[4:6])[0]
            frame_height = struct.unpack('<H', frame_header[6:8])[0]
            
            # Read frame data (RLE compressed)
            frame_size = struct.unpack('<I', frame_header[16:20])[0]
            frame_data = f.read(frame_size)
            
            # Decompress RLE
            img_data = decompress_rle(frame_data, frame_width, frame_height)
            
            # Create image
            img = Image.frombytes('P', (frame_width, frame_height), bytes(img_data))
            
            # Apply palette (default RA2 palette)
            palette = create_ra2_palette()
            img.putpalette(palette)
            
            # Convert to RGBA
            img = img.convert('RGBA')
            
            frames.append(img)
        
        return frames

def decompress_rle(data, width, height):
    """Decompress RLE encoded frame data"""
    result = []
    i = 0
    
    while i < len(data) and len(result) < width * height:
        byte = data[i]
        
        if byte == 0:
            # Run of transparent pixels
            if i + 1 < len(data):
                count = data[i + 1]
                result.extend([0] * count)
                i += 2
            else:
                break
        else:
            # Single pixel
            result.append(byte)
            i += 1
    
    # Pad to full size
    while len(result) < width * height:
        result.append(0)
    
    return result[:width * height]

def create_ra2_palette():
    """Create default RA2 palette"""
    # This is a simplified palette
    # Real RA2 uses specific palette files
    palette = []
    
    # Generate a basic palette
    for i in range(256):
        if i == 0:
            # Transparent
            palette.extend([0, 0, 0])
        else:
            # Generate colors
            r = (i * 7) % 256
            g = (i * 13) % 256
            b = (i * 19) % 256
            palette.extend([r, g, b])
    
    return palette

def create_sprite_sheet(frames, output_file):
    """Create sprite sheet from frames"""
    if not frames:
        return
    
    frame_width = frames[0].width
    frame_height = frames[0].height
    
    # Calculate grid size
    frames_per_row = 4  # 4 frames per direction
    num_directions = len(frames) // frames_per_row
    
    if num_directions == 0:
        num_directions = 1
    
    # Create sprite sheet
    sheet_width = frame_width * frames_per_row
    sheet_height = frame_height * num_directions
    
    sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
    
    for i, frame in enumerate(frames):
        row = i // frames_per_row
        col = i % frames_per_row
        
        x = col * frame_width
        y = row * frame_height
        
        sheet.paste(frame, (x, y), frame)
    
    sheet.save(output_file)
    print(f"Saved sprite sheet: {output_file}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python shp-to-png.py <input.shp> <output.png>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Converting {input_file}...")
    frames = read_shp(input_file)
    
    if frames:
        create_sprite_sheet(frames, output_file)
    else:
        print("No frames found!")

if __name__ == '__main__':
    main()
`;

  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  fs.writeFileSync(converterPath, converterCode);
  fs.chmodSync(converterPath, '755');
  
  console.log('Created SHP converter tool');
  return converterPath;
}

// 提供替代方案
function showAlternatives() {
  console.log('\n=== 未找到红警2游戏文件 ===\n');
  console.log('你可以通过以下方式获取精灵图:\n');
  
  console.log('方案1: 使用 OpenRA (免费开源)');
  console.log('  1. 下载 OpenRA: https://www.openra.net/download/');
  console.log('  2. 安装并运行 Red Alert 2 mod');
  console.log('  3. 精灵图将自动下载到:');
  console.log(`     ~/Library/Application Support/OpenRA/Content/ra2/\n`);
  
  console.log('方案2: 购买红警2');
  console.log('  - Steam: https://store.steampowered.com/app/2229850/');
  console.log('  - EA App: https://www.ea.com/games/command-and-conquer/\n');
  
  console.log('方案3: 使用当前模拟精灵图');
  console.log('  当前游戏已经包含模拟红警2风格的精灵图');
  console.log('  效果已经相当接近原版\n');
  
  console.log('方案4: 手动放置精灵图');
  console.log(`  如果你有精灵图文件，直接放入:`);
  console.log(`  ${SPRITES_DIR}/units/`);
  console.log(`  ${SPRITES_DIR}/buildings/\n`);
}

// 主函数
function main() {
  console.log('=== 红警2精灵图设置工具 ===\n');
  
  // 检查游戏安装
  const gamePath = checkRA2Installation();
  
  if (gamePath) {
    console.log('\n找到红警2安装!');
    
    // 查找 .mix 文件
    const mixFiles = findMixFiles(gamePath);
    
    if (mixFiles.length > 0) {
      console.log(`\n找到 ${mixFiles.length} 个 .mix 文件:`);
      mixFiles.forEach(f => console.log(`  - ${f}`));
      
      // 创建转换工具
      createSHPConverter();
      
      console.log('\n下一步:');
      console.log('1. 使用 XCC Mixer 从 .mix 文件提取 .shp 文件');
      console.log('2. 使用提供的 Python 脚本转换 .shp 为 .png');
      console.log('3. 将 .png 文件放入 public/assets/sprites/ 目录');
    } else {
      console.log('\n未找到 .mix 文件，可能安装不完整');
      showAlternatives();
    }
  } else {
    showAlternatives();
  }
  
  // 创建目录结构
  fs.mkdirSync(path.join(SPRITES_DIR, 'units'), { recursive: true });
  fs.mkdirSync(path.join(SPRITES_DIR, 'buildings'), { recursive: true });
  
  console.log('\n目录结构已创建:');
  console.log(`  ${SPRITES_DIR}/units/`);
  console.log(`  ${SPRITES_DIR}/buildings/`);
}

main();
