// This provider handles Azure Cognitive Services Face API calls

const AZURE_ENDPOINT = import.meta.env.VITE_AZURE_FACE_ENDPOINT;
const AZURE_KEY = import.meta.env.VITE_AZURE_FACE_KEY;

// Helper for making API calls
async function callAzure(path: string, method: string, body?: any, isBinary = false) {
  if (!AZURE_ENDPOINT || !AZURE_KEY) throw new Error("Azure credentials missing in .env");

  // Ensure endpoint doesn't have trailing slash
  const baseUrl = AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT;
  const url = `${baseUrl}/face/v1.0${path}`;

  let headers: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': AZURE_KEY,
  };

  if (isBinary) {
    headers['Content-Type'] = 'application/octet-stream';
  } else if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Handle exponential backoff for TP Rate Limits (HTTP 429)
  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    const res = await fetch(url, {
      method,
      headers,
      body: isBinary ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
      retries--;
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Azure API Error: ${res.status} - ${errorText}`);
    }

    // Some endpoints return 202 empty bodies
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  
  throw new Error("Azure API Error: Rate limit exceeded after retries.");
}

// Convert HTMLImageElement to Blob for Azure
function imageToBlob(imgElement: HTMLImageElement): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(imgElement, 0, 0);
    canvas.toBlob((blob) => {
      resolve(blob as Blob);
    }, 'image/jpeg', 0.9);
  });
}

// Ensure the LargeFaceList exists for the event
async function ensureFaceListExists(eventId: string) {
  try {
    await callAzure(`/largefacelists/${eventId}`, 'GET');
  } catch (e: any) {
    if (e.message.includes('404')) {
      // Create it
      await callAzure(`/largefacelists/${eventId}`, 'PUT', {
        name: `Event ${eventId}`
      });
    } else {
      throw e;
    }
  }
}

export const azureProvider = {
  async registerFaceToEvent(imgElement: HTMLImageElement, photoId: string, eventId: string) {
    await ensureFaceListExists(eventId);
    const blob = await imageToBlob(imgElement);
    
    // Add face to the list, passing photoId as userData
    await callAzure(`/largefacelists/${eventId}/persistedfaces?userData=${photoId}`, 'POST', blob, true);
    
    // Must train the list after adding logic
    // We shouldn't train on EVERY upload as it's slow, usually we train the list once bulk upload is done.
    // For real-time, calling train is fine if list is small, or we defer it. Let's fire and forget training.
    callAzure(`/largefacelists/${eventId}/train`, 'POST').catch(console.warn);
  },

  async findSimilarFaces(selfieImgElement: HTMLImageElement, eventId: string) {
    // 1. Detect the selfie face
    const selfyBlob = await imageToBlob(selfieImgElement);
    const detectResults = await callAzure(`/detect?returnFaceId=true`, 'POST', selfyBlob, true);
    
    if (!detectResults || detectResults.length === 0) {
      throw new Error("No face found in selfie");
    }

    const faceId = detectResults[0].faceId;

    // 2. Search against event list
    const similarResults = await callAzure(`/findsimilars`, 'POST', {
      faceId: faceId,
      largeFaceListId: eventId,
      maxNumOfCandidatesReturned: 50,
      mode: "matchFace"
    });

    if (!similarResults || similarResults.length === 0) return [];

    // Azure findsimilars returns an array of matched persistedFaceIds.
    // Sadly, it doesn't return the raw `userData` string in this API call.
    // We must fetch the userData for those specific persistedFaceIds.
    
    const matchedPhotos: { photo_id: string, confidence: number }[] = [];
    
    for (const match of similarResults) {
      try {
        const persistedFaceInfo = await callAzure(`/largefacelists/${eventId}/persistedfaces/${match.persistedFaceId}`, 'GET');
        if (persistedFaceInfo && persistedFaceInfo.userData) {
          matchedPhotos.push({
            photo_id: persistedFaceInfo.userData,
            confidence: match.confidence
          });
        }
      } catch (e) {
        console.warn("Failed to fetch userData for face", match.persistedFaceId);
      }
    }

    return matchedPhotos;
  }
};
