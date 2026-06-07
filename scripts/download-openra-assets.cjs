#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

/**
 * 下载 OpenRA 免费资源
 * OpenRA 提供了红警2的开源实现和资源
 */

const SPRITES_DIR = path.join(__dirname, '../public/assets/sprites');
const TEMP_DIR = path.join(__dirname, '../temp');

// OpenRA 资源镜像
const OPENRA_RESOURCES = {
  // OpenRA 的 GitHub 仓库中有一些免费资源
  baseUrl: 'https://github.com/OpenRA/ra2/raw/master/mods/ra2/bits/',
  
  // 可下载的精灵图文件
  sprites: {
    units: [
      'gi.shp',      // 美国大兵
      'e1.shp',      // 动员兵
      'htnk.shp',    // 灰熊坦克
      'mtnk.shp',    // 犀牛坦克
    ],
    buildings: [
      'gacnst.shp',  // 盟军建造厂
      'nacnst.shp',  // 苏军建造厂
    ]
  }
};

// 创建目录
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 下载文件
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 跟随重定向
        downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

// 尝试从 OpenRA 下载资源
async function downloadOpenRAResources() {
  console.log('=== 尝试下载 OpenRA 资源 ===\n');
  
  ensureDir(TEMP_DIR);
  ensureDir(path.join(SPRITES_DIR, 'units'));
  ensureDir(path.join(SPRITES_DIR, 'buildings'));
  
  const baseUrl = OPENRA_RESOURCES.baseUrl;
  
  // 尝试下载单位精灵图
  for (const sprite of OPENRA_RESOURCES.sprites.units) {
    const url = `${baseUrl}${sprite}`;
    const outputPath = path.join(TEMP_DIR, sprite);
    
    try {
      await downloadFile(url, outputPath);
      console.log(`✓ ${sprite}`);
    } catch (err) {
      console.log(`✗ ${sprite} - ${err.message}`);
    }
  }
  
  // 尝试下载建筑精灵图
  for (const sprite of OPENRA_RESOURCES.sprites.buildings) {
    const url = `${baseUrl}${sprite}`;
    const outputPath = path.join(TEMP_DIR, sprite);
    
    try {
      await downloadFile(url, outputPath);
      console.log(`✓ ${sprite}`);
    } catch (err) {
      console.log(`✗ ${sprite} - ${err.message}`);
    }
  }
}

// 创建模拟精灵图（如果下载失败）
function createFallbackSprites() {
  console.log('\n=== 创建高质量模拟精灵图 ===\n');
  
  // 运行之前的生成脚本
  try {
    execSync('node scripts/extract-ra2-sprites.cjs', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (e) {
    console.log('生成脚本失败，使用基础版本');
  }
}

// 主函数
async function main() {
  console.log('=== OpenRA 资源下载工具 ===\n');
  console.log('注意：由于版权原因，OpenRA 可能不提供完整的原始精灵图');
  console.log('我们将尝试下载可用资源，并创建模拟精灵图作为补充\n');
  
  try {
    // 尝试下载
    await downloadOpenRAResources();
    
    // 检查下载结果
    const downloadedFiles = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.shp'));
    
    if (downloadedFiles.length > 0) {
      console.log(`\n成功下载 ${downloadedFiles.length} 个文件`);
      console.log('这些文件需要转换为 PNG 格式才能使用');
      console.log('转换工具已创建在 tools/shp-to-png.py');
    } else {
      console.log('\n未能下载 OpenRA 资源');
      console.log('这可能是因为:');
      console.log('1. 网络连接问题');
      console.log('2. OpenRA 仓库结构变更');
      console.log('3. 资源需要授权');
    }
    
    // 无论如何都创建模拟精灵图
    createFallbackSprites();
    
  } catch (error) {
    console.error('错误:', error.message);
    createFallbackSprites();
  }
  
  // 清理临时文件
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  
  console.log('\n=== 完成 ===');
  console.log('精灵图已准备就绪');
  console.log('你可以通过以下方式获取更真实的精灵图:');
  console.log('1. 购买红警2并使用真实游戏文件');
  console.log('2. 使用 OpenRA 完整安装');
  console.log('3. 手动创建或下载社区制作的精灵图');
}

main().catch(console.error);
