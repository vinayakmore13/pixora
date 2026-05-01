import { access } from 'node:fs/promises';
import path from 'node:path';

const requiredFiles = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const modelDir = path.resolve('public', 'models');
const missing = [];

for (const file of requiredFiles) {
  try {
    await access(path.join(modelDir, file));
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error(`Missing face model files in ${modelDir}:`);
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  console.error('Run: npm run download:models');
  process.exit(1);
}

console.log(`All required face model files are present in ${modelDir}.`);
