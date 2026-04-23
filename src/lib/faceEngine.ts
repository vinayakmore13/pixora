import { localProvider, extractFaceDescriptor } from './providers/localProvider';
import { azureProvider } from './providers/azureProvider';

// "LOCAL" or "AZURE"
const PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'LOCAL';

export interface FaceMatch {
  photo_id: string;
  confidence: number;
}

export const faceEngine = {
  /**
   * Called by UploadManager. 
   * Dual Processing: ALWAYS stores local vector. If Azure is enabled, also uploads to Azure.
   */
  async extractAndStoreFaces(imgElement: HTMLImageElement, photoId: string, eventId: string, isFastSelection: boolean = false): Promise<void> {
    // 1. ALWAYS run local for the pgvector fallback continuity
    try {
      await localProvider.extractAndStore(imgElement, photoId, isFastSelection);
    } catch (e) {
      console.error("Local PGVector storing failed:", e);
    }

    // 2. Hybrid Hybrid
    if (PROVIDER === 'AZURE') {
      try {
        console.log("Azure AI: Registering face to event list...");
        await azureProvider.registerFaceToEvent(imgElement, photoId, eventId);
      } catch (e) {
        console.error("Azure AI Face registration failed (Out of credits?). Fallback to local handles this.", e);
      }
    }
  },

  /**
   * Called by Gallery/SelfieCapture for Face Identification
   */
  async findMyPhotos(selfieImgElement: HTMLImageElement, eventId: string): Promise<FaceMatch[]> {
    if (PROVIDER === 'AZURE') {
      try {
        console.log("Azure AI: Searching for photos...");
        const azureMatches = await azureProvider.findSimilarFaces(selfieImgElement, eventId);
        
        // If Azure worked, we return it. (Map 0-1 confidence where 1 corresponds to 100%)
        return azureMatches.map(m => ({ photo_id: m.photo_id, confidence: m.confidence }));

      } catch (e) {
        // If Azure hits a 429 too many times, or they ran out of credits, fallback to local pgvector seamlessly
        console.warn("Azure Search failed or out of credits! Falling back to Local PGVector.");
      }
    }

    // FALLBACK / default local matching
    const localDescriptor = await extractFaceDescriptor(selfieImgElement);
    if (!localDescriptor) {
      throw new Error("No face found in selfie");
    }

    const localMatches = await localProvider.findSimilarFaces(localDescriptor);
    return localMatches.map((m: any) => ({
      photo_id: m.photo_id,
      confidence: m.similarity // pgvector returns similarity
    }));
  }
};
