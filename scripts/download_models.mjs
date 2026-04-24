import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, '../public/models');

// Ensure models directory exists
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log(`Created directory: ${modelsDir}`);
}

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

// Try multiple CDN sources in order
const CDN_SOURCES = [
  'https://unpkg.com/face-api.js@0.22.2/weights/',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/',
];

let baseUrl = CDN_SOURCES[0]; // Start with unpkg (most reliable)

let downloaded = 0;
let failed = 0;
let currentCdnIndex = 0;

const downloadFile = (file, cdnIndex = 0) => {
  return new Promise((resolve, reject) => {
    if (cdnIndex >= CDN_SOURCES.length) {
      reject(new Error('All CDN sources exhausted'));
      return;
    }

    const dest = path.join(modelsDir, file);
    const url = CDN_SOURCES[cdnIndex] + file;
    
    // ALWAYS delete and re-download - don't trust partial files
    if (fs.existsSync(dest)) {
      try {
        const stats = fs.statSync(dest);
        console.log(`⚠ Removing incomplete file (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${file}`);
        fs.unlinkSync(dest);
      } catch (err) {
        console.error(`✗ Failed to remove ${file}:`, err.message);
      }
    }
    
    console.log(`↓ Downloading from CDN ${cdnIndex + 1}: ${file}`);
    
    const req = https.get(url, (response) => {
      // Check for HTML response (indicates 404 or error page)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html') && response.statusCode !== 200) {
        console.log(`  CDN ${cdnIndex + 1} returned HTML (not found), trying next...`);
        response.resume(); // Drain the response
        // Try next CDN
        downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(dest);
        let receivedBytes = 0;
        const contentLength = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          const percent = contentLength ? ((receivedBytes / contentLength) * 100).toFixed(1) : '?';
          process.stdout.write(`\r  ${file}: ${(receivedBytes / 1024 / 1024).toFixed(2)}MB / ${(contentLength / 1024 / 1024).toFixed(2)}MB (${percent}%)`);
        });
        
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          const stats = fs.statSync(dest);
          console.log(`\r✓ Downloaded (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${file}`);
          
          // Verify file size is reasonable
          if (stats.size < 1024) {
            console.error(`✗ Downloaded file is too small (${stats.size} bytes), likely incomplete`);
            fs.unlinkSync(dest);
            // Try next CDN
            downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
            return;
          }
          
          downloaded++;
          // Update global baseUrl if this CDN worked
          if (cdnIndex > currentCdnIndex) {
            currentCdnIndex = cdnIndex;
            console.log(`  ✓ Using CDN ${cdnIndex + 1} for remaining files`);
          }
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(dest, () => {});
          console.error(`\n✗ File write error for ${file}:`, err.message);
          // Try next CDN
          downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
        });
      } else {
        console.error(`\n✗ HTTP ${response.statusCode}: ${file}`);
        response.resume(); // Drain the response
        // Try next CDN
        downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
      }
    }).on('error', (err) => {
      console.error(`\n✗ Download error from CDN ${cdnIndex + 1} for ${file}:`, err.message);
      // Try next CDN
      downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
    });
    
    // Timeout after 120 seconds per file
    req.setTimeout(120000, () => {
      req.destroy();
      console.error(`\n✗ Download timeout from CDN ${cdnIndex + 1}: ${file}`);
      // Try next CDN
      downloadFile(file, cdnIndex + 1).then(resolve).catch(reject);
    });
  });
};

const downloadAll = async () => {
  console.log('\n🚀 Downloading face-api.js models...\n');
  console.log(`Available CDN sources:`);
  CDN_SOURCES.forEach((src, i) => console.log(`  ${i + 1}. ${src}`));
  console.log(`\nTarget directory: ${modelsDir}\n`);
  
  for (const file of files) {
    try {
      await downloadFile(file, 0); // Start with CDN 0
    } catch (err) {
      console.error(`✗ Failed to download ${file} from all CDN sources`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Downloaded: ${downloaded}/${files.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${files.length}`);
    console.log(`\nTroubleshooting:`);
    console.log(`- Check your internet connection`);
    console.log(`- Check available disk space (need ~200MB)`);
    console.log(`- Try again in a few moments`);
    process.exit(1);
  } else {
    console.log('\n✓ All models downloaded successfully from CDN ' + CDN_SOURCES[currentCdnIndex] + '!');
    console.log('Restart your dev server: npm run dev\n');
    process.exit(0);
  }
};

downloadAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
