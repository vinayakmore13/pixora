import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let modelLoadError: Error | null = null;

export const loadModels = async () => {
  if (modelsLoaded) return;
  if (modelLoadError) throw modelLoadError;
  
  try {
    const MODEL_URL = '/models';
    
    console.log('[FaceAPI] Loading models from local directory:', MODEL_URL);
    
    // Load models sequentially to get clear error messages about which model fails
    const models = [
      { name: 'ssdMobilenetv1', loader: () => faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL) },
      { name: 'faceLandmark68Net', loader: () => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL) },
      { name: 'faceRecognitionNet', loader: () => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) },
      { name: 'faceExpressionNet', loader: () => faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL) },
    ];
    
    for (const model of models) {
      try {
        console.log(`[FaceAPI] Loading ${model.name}...`);
        await model.loader();
        console.log(`[FaceAPI] ✓ ${model.name} loaded successfully`);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error(`[FaceAPI] ✗ Failed to load ${model.name}:`, errMsg);
        
        // Enhanced error message for various failure modes
        if (errMsg.includes('<!doctype') || errMsg.includes('<!DOCTYPE')) {
          throw new Error(
            `CDN returned error page (404 or 50x) for ${model.name}.\n\n` +
            `This means the model file doesn't exist at the CDN URL.\n\n` +
            `To fix:\n` +
            `1. Run: npm run download:models\n` +
            `2. Restart dev server: npm run dev\n\n` +
            `The download script will try multiple CDN sources automatically.`
          );
        }
        
        if (errMsg.includes('tensor') || errMsg.includes('values')) {
          throw new Error(
            `Model file corrupted: ${model.name}\n\n` +
            `The model file appears to be incomplete or corrupted.\n\n` +
            `To fix:\n` +
            `1. Run: npm run download:models\n` +
            `2. Restart dev server: npm run dev\n\n` +
            `Technical: ${errMsg}`
          );
        }
        throw err;
      }
    }
    
    modelsLoaded = true;
    console.log('[FaceAPI] ✓ All models loaded successfully');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    modelLoadError = error;
    console.error('[FaceAPI] Failed to load models:', error);
    throw error;
  }
};

// Reset models (useful for debugging or if files are updated)
export const resetModels = () => {
  modelsLoaded = false;
  modelLoadError = null;
  console.log('[FaceAPI] Models reset, will reload on next usage');
};

export const extractFaceDescriptor = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
  if (!modelsLoaded) {
    await loadModels();
  }
  
  // Detect a single face with landmarks and descriptor
  const detection = await faceapi.detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  if (!detection) {
    return null; // No face found
  }
  
  // Return the descriptor which is a Float32Array(128)
  return detection.descriptor;
};

export const extractAllFaces = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    if (!modelsLoaded) {
      await loadModels();
    }
    
    // Detect all faces in an image
    const detections = await faceapi.detectAllFaces(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptors();
      
    return detections.map(d => ({
        descriptor: d.descriptor,
        box: d.detection.box
    }));
};
