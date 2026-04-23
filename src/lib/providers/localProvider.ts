import * as faceapi from 'face-api.js';
import { supabase } from '../supabaseClient';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  
  try {
    let MODEL_URL = 'https://unpkg.com/face-api.js@0.22.2/dist/models';
    try {
      console.log('[FaceAPI] Trying unpkg CDN...');
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    } catch (cdnErr) {
      console.log('[FaceAPI] unpkg failed, trying jsDelivr...');
      MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    }
    
    await Promise.all([
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log("Face API models loaded successfully from:", MODEL_URL);
  } catch (err) {
    console.error("Failed to load face API models:", err);
    modelsLoaded = false;
    throw new Error("Face detection unavailable. Please try again or refresh the page.");
  }
};

export const extractFaceDescriptor = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
  if (!modelsLoaded) {
    await loadModels();
  }
  
  const detection = await faceapi.detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  if (!detection) {
    return null;
  }
  
  return detection.descriptor;
};

export const extractAllFaces = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    if (!modelsLoaded) {
      await loadModels();
    }
    
    const detections = await faceapi.detectAllFaces(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptors();
      
    return detections.map(d => ({
        descriptor: d.descriptor,
        box: d.detection.box
    }));
};

export const localProvider = {
  async extractAndStore(imgElement: HTMLImageElement, photoId: string, isFastSelection: boolean = false) {
    const faces = await extractAllFaces(imgElement);
    if (faces && faces.length > 0) {
      const faceRecords = faces.map(f => ({
        photo_id: photoId,
        face_descriptor: `[${Array.from(f.descriptor).join(',')}]`
      }));
      
      const targetTable = isFastSelection ? 'fast_selection_photo_faces' : 'photo_faces';
      const { error: faceError } = await supabase.from(targetTable).insert(faceRecords);
      
      if (faceError) {
        console.error(`Local face extraction failed to save to ${targetTable}:`, faceError);
      }
    }
  },

  async findSimilarFaces(selfieDescriptor: Float32Array) {
    const vectorString = `[${Array.from(selfieDescriptor).join(',')}]`;
    const { data: matches, error } = await supabase.rpc('match_faces', {
      query_embedding: vectorString,
      match_threshold: 0.6,
      match_count: 50
    });

    if (error) throw error;
    return matches || [];
  }
};
