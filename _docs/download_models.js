import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const downloadFile = (file) => {
  return new Promise((resolve, reject) => {
    const dest = path.join(modelsDir, file);
    if (fs.existsSync(dest)) {
      console.log(`Already exists: ${file}`);
      resolve();
      return;
    }
    const req = https.get(baseUrl + file, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(dest);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Downloaded: ${file}`);
          resolve();
        });
      } else {
        console.error(`Failed to download ${file}, status: ${response.statusCode}`);
        reject();
      }
    });

    req.on('error', (err) => {
      console.error(`Error downloading ${file}: ${err.message}`);
      reject(err);
    });
  });
};

async function downloadAll() {
  for (const file of files) {
    await downloadFile(file);
  }
  console.log('All models downloaded successfully!');
}

downloadAll();
