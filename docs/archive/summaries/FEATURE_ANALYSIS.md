# WebHub Feature Analysis

## Overview
This document provides a detailed analysis of three key features in the WebHub application: Camera/Photo Sync, AI/Face Detection, and Client Selection/Delivery System.

---

## 1. Camera/Photo Sync Functionality

### **Current Implementation**
The Camera Sync feature enables automatic photo synchronization from WiFi-enabled cameras (Canon, Sony, Nikon) and phone cameras directly to the platform. It provides a real-time syncing service with statistics tracking and connection testing.

### **Files Implementing This Feature**
- [src/components/CameraSync.tsx](src/components/CameraSync.tsx) - UI Component
- [src/lib/cameraSync.ts](src/lib/cameraSync.ts) - Core Service Logic
- [src/lib/uploadManager.ts](src/lib/uploadManager.ts) - File Upload & Queue Management

### **Architecture & Flow**

#### CameraSyncService Class (cameraSync.ts)
This service handles the connection, sync operations, and statistics tracking:

```typescript
export class CameraSyncService {
    private config: CameraConfig;
    private eventId: string;
    private uploaderId: string;
    private isRunning: boolean = false;
    private uploadManager: UploadManager;
    private syncInterval: NodeJS.Timeout | null = null;
    private stats: CameraSyncStats;
    private syncedPhotoIds: Set<string> = new Set();
    
    // Configuration types
    type CameraType = 'canon' | 'sony' | 'nikon' | 'phone';
}
```

#### Connection Testing by Camera Type

**Canon CCAPI (Canon Cameras):**
```typescript
private async testCanonConnection(): Promise<boolean> {
    try {
        const url = `http://${this.config.ipAddress}:${this.config.port || 8080}/ccapi/`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Canon connection test failed:', error);
        return false;
    }
}
```

**Sony Imaging Edge API:**
```typescript
private async testSonyConnection(): Promise<boolean> {
    try {
        const url = `http://${this.config.ipAddress}:${this.config.port || 8080}/sony/camera`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: 'getVersions',
                params: [],
                id: 1,
                version: '1.0'
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Sony connection test failed:', error);
        return false;
    }
}
```

**Nikon SnapBridge API:**
```typescript
private async testNikonConnection(): Promise<boolean> {
    try {
        const url = `http://${this.config.ipAddress}:${this.config.port || 8080}/api`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Nikon connection test failed:', error);
        return false;
    }
}
```

#### Sync Loop
Once connected, the service polls for new photos every 10 seconds:

```typescript
async start(): Promise<void> {
    if (this.isRunning) return;
    
    try {
        this.isRunning = true;
        this.stats.isRunning = true;
        this.onStatsUpdate?.(this.stats);

        // Test connection first
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error(`Failed to connect to ${this.config.type} camera`);
        }

        // Start sync loop - check every 10 seconds for new photos
        this.syncInterval = setInterval(() => {
            this.syncPhotos();
        }, 10000);

        // Initial sync
        await this.syncPhotos();
    } catch (error) {
        this.isRunning = false;
        this.stats.isRunning = false;
        this.onStatsUpdate?.(this.stats);
        throw error;
    }
}
```

#### Photo Fetching (Canon Example)
```typescript
private async fetchCanonPhotos(): Promise<File[]> {
    const photos: File[] = [];
    const baseUrl = `http://${this.config.ipAddress}:${this.config.port || 8080}`;

    try {
        // Get list of contents from Canon CCAPI
        const response = await fetch(`${baseUrl}/ccapi/ver100/contents`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Canon API error: ${response.status}`);
        }

        const data = await response.json();

        // Process each item
        for (const item of data.path || []) {
            // Skip if already synced
            if (this.syncedPhotoIds.has(item.path)) continue;

            // Only process JPEG/HEIF images
            if (item.fileformat === 'jpeg' || item.fileformat === 'heif') {
                try {
                    const photoResponse = await fetch(`${baseUrl}${item.path}`);
                    if (photoResponse.ok) {
                        const blob = await photoResponse.blob();
                        const file = new File([blob], item.name, {
                            type: `image/${item.fileformat}`
                        });
                        photos.push(file);
                        this.syncedPhotoIds.add(item.path);
                    }
                } catch (error) {
                    console.error(`Failed to fetch Canon photo ${item.path}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching Canon photos:', error);
        throw error;
    }

    return photos;
}
```

#### UI Component (CameraSync.tsx)
```typescript
export function CameraSync({ eventId, eventTitle }: CameraSyncProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('canon');
  const [ipAddress, setIpAddress] = useState('192.168.1.1');
  const [port, setPort] = useState('8080');
  const [stats, setStats] = useState<CameraSyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: null,
    isRunning: false,
    currentCamera: null
  });

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    setErrorMessage(null);

    try {
      const config: CameraConfig = {
        type: cameraType,
        ipAddress,
        port: parseInt(port)
      };

      const service = new CameraSyncService(config, eventId, user?.id || '');
      const connected = await service.testConnection();

      if (connected) {
        setConnectionStatus('success');
        setIsConnected(true);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Failed to connect to camera');
        setIsConnected(false);
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed');
      setIsConnected(false);
    }
  };

  const startSync = async () => {
    if (!user) return;

    try {
      const config: CameraConfig = {
        type: cameraType,
        ipAddress,
        port: parseInt(port)
      };

      const service = new CameraSyncService(config, eventId, user.id, {
        onStatsUpdate: handleStatsUpdate,
        onError: handleError
      });

      await service.start();
      setSyncService(service);
      setIsSyncing(true);
      
      // Save settings
      await saveCameraSyncSettings(eventId, config);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start sync');
    }
  };
}
```

### **Capabilities**
✅ **Multi-camera support**: Canon CCAPI, Sony Imaging Edge, Nikon SnapBridge  
✅ **WiFi-based synchronization**: No physical cable needed  
✅ **Automatic polling**: Checks for new photos every 10 seconds  
✅ **Duplicate prevention**: Tracks synced photo IDs to avoid re-uploading  
✅ **Statistics tracking**: Monitors total synced, failed, and last sync time  
✅ **Connection testing**: Tests connectivity before starting sync  
✅ **Settings persistence**: Saves camera configuration per event in Supabase  
✅ **Error handling**: Comprehensive error reporting and user feedback  
✅ **Real-time UI updates**: Live syncing indicator and progress stats  

### **Limitations**
❌ **Phone camera support incomplete**: Phone camera sync requires native app implementation  
❌ **No web progress tracking**: Upload progress is simulated (Supabase doesn't provide real-time progress)  
❌ **Manual configuration required**: Users must know camera IP address and port  
❌ **Single photo format support**: Only JPEG/HEIF formats processed  
❌ **Cross-origin restrictions**: WiFi camera access may fail due to CORS on different networks  
❌ **No authentication**: Current implementation doesn't support camera authentication tokens  
❌ **Network dependency**: Requires stable WiFi connection between camera and app  

---

## 2. AI/Face Detection Capabilities

### **Current Implementation**
The app integrates face-api.js, a deep learning library, to extract facial descriptors (128-dimensional vectors) from images. These are used for:
- User identity verification via selfie capture
- Automatic face detection during photo uploads
- Privacy-preserving facial recognition (stores vectors, not images)

### **Files Implementing This Feature**
- [src/lib/faceApi.ts](src/lib/faceApi.ts) - Face Detection Core
- [src/components/SelfieCapture.tsx](src/components/SelfieCapture.tsx) - Selfie Modal
- [src/lib/uploadManager.ts](src/lib/uploadManager.ts) - Integration with uploads

### **Architecture & Model Loading**

#### Face API Model Setup
```typescript
import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  
  try {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),      // Face detection
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),    // 68-point landmarks
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),   // 128D descriptor
    ]);
    modelsLoaded = true;
    console.log("Face API models loaded successfully");
  } catch (err) {
    console.error("Failed to load face API models:", err);
    throw err;
  }
};
```

**Models Loaded:**
- **SSD MobileNetv1**: Detects face regions in images
- **Face Landmark 68**: Identifies 68 facial points (eyes, nose, mouth, etc.)
- **Face Recognition Net**: Generates 128-dimensional facial descriptor vectors

#### Single Face Descriptor Extraction
```typescript
export const extractFaceDescriptor = async (
    imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
) => {
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
```

#### Multiple Faces Extraction
```typescript
export const extractAllFaces = async (
    imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
) => {
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
```

#### Selfie Capture Component
```typescript
export function SelfieCapture({ onCaptureComplete, onClose }: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processAndSave = async () => {
    if (!imgSrc) return;
    setIsProcessing(true);

    try {
      // Create an image element to pass to face-api
      const img = new Image();
      img.src = imgSrc;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const descriptor = await extractFaceDescriptor(img);

      if (!descriptor) {
        setError("No face detected. Please ensure your face is clearly visible, well-lit, and try again.");
        setIsProcessing(false);
        return;
      }

      // Format descriptor to match pgvector format: '[val1, val2, ...]'
      const vectorString = `[${Array.from(descriptor).join(',')}]`;

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Save to Supabase profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ selfie_descriptor: vectorString })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onCaptureComplete();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process face");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Set Up Face ID</h2>
        </div>
        {/* Webcam capture with canvas overlay */}
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "user" }}
          screenshotQuality={0.92}
        />
      </div>
    </div>
  );
}
```

#### Face Extraction During Upload
```typescript
// From uploadManager.ts - Step 1.5: Extract faces
const img = new Image();
img.src = URL.createObjectURL(compressed.file);
await new Promise(resolve => {
  img.onload = resolve;
});
const extractedFaces = await extractAllFaces(img);
URL.revokeObjectURL(img.src);

// ... later in savePhotoMetadata:
// Save detected faces into photo_faces table
if (faces && faces.length > 0) {
  const faceRecords = faces.map(f => ({
    photo_id: data.id,
    face_descriptor: `[${Array.from(f.descriptor).join(',')}]`
  }));
  const { error: faceError } = await supabase
    .from('photo_faces')
    .insert(faceRecords);
  if (faceError) {
    console.error("Failed to save extracted faces:", faceError);
  }
}
```

### **Capabilities**
✅ **Single & multiple face detection**: Can extract one or all faces in an image  
✅ **Face descriptor extraction**: Generates 128-dimensional vectors for each face  
✅ **Facial landmark detection**: Identifies 68 key facial points  
✅ **Privacy-preserving**: Only stores mathematical vectors, not images  
✅ **Real-time webcam processing**: Selfie capture with instant feedback  
✅ **Per-photo face extraction**: Automatically extracts all faces during upload  
✅ **Error feedback**: Clear messages for poor lighting or face not detected  
✅ **Model caching**: Models are loaded once and cached in memory  
✅ **High accuracy**: Uses proven face-api.js (based on face.js library)  

### **Limitations**
❌ **No face recognition matching**: Descriptor extraction only; no comparison logic implemented  
❌ **Single face UI limitation**: SelfieCapture only handles single face for user profile  
❌ **No age/gender detection**: Current models only extract identity vectors  
❌ **Browser compatibility**: Requires WebGL for GPU acceleration; CPU fallback is slow  
❌ **No batch processing**: Faces extracted one-by-one during uploads  
❌ **Model file size**: ~17MB of model files (visible in public/models/)  
❌ **No de-duplication**: Doesn't check if extracted face already exists for a person  
❌ **Cold start time**: First face extraction takes 2-3 seconds (model loading)  
❌ **Incomplete integration**: Face data saved but no query/comparison endpoints exist  

---

## 3. Client Selection/Delivery System

### **Current Implementation**
This feature allows photographers to share photo galleries with clients via selection portals. Clients can browse curated photos, favorite them (with limits), compare selections, and submit their picks. The system tracks favorites with approval workflow.

### **Files Implementing This Feature**
- [src/components/SelectionPortal.tsx](src/components/SelectionPortal.tsx) - Selection Portal UI
- [src/components/BookingFlow.tsx](src/components/BookingFlow.tsx) - Booking/Package Purchase
- [src/lib/photoService.ts](src/lib/photoService.ts) - Photo Gallery & Download

### **Selection Portal Architecture**

#### Selection Portal Component
```typescript
export function SelectionPortal() {
  const { code } = useParams();
  const [selection, setSelection] = useState<SelectionConfig | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  
  const [guestId, setGuestId] = useState<string | null>(
    sessionStorage.getItem(`guest_id_${code}`) || null
  );
  const [guestName, setGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Comparison Mode State
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  interface SelectionConfig {
    id: string;
    event_id: string;
    max_photos: number;
    status: string;
    deadline: string | null;
  }
}
```

#### Data Loading Flow
```typescript
const loadSelectionData = async () => {
  try {
    setLoading(true);
    
    // 1. Get selection config by code
    const { data: selData, error: selError } = await supabase
      .from('photo_selections')
      .select('*')
      .eq('selection_code', code)
      .single();
      
    if (selError) throw selError;
    setSelection(selData);

    // 2. Get photos (edited only) - photographer has curated these
    const { data: photoData, error: photoError } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', selData.event_id)
      .eq('is_edited', true)  // Only show edited photos
      .order('created_at', { ascending: true });
      
    if (photoError) throw photoError;
    setPhotos(photoData || []);

    // 3. Get existing favorites for this portal
    loadFavorites(selData.id);

  } catch (err) {
    console.error(err);
    setError('Invalid selection code or portal not found.');
  } finally {
    setLoading(false);
  }
};
```

#### Guest Registration (Anonymous Access)
```typescript
const handleJoin = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selection || !guestName.trim()) return;
  
  try {
    setSubmitting(true);
    
    // Check if guest already exists
    const { data: existing } = await supabase
      .from('photo_selection_guests')
      .select('*')
      .eq('selection_id', selection.id)
      .eq('name', guestName.trim())
      .maybeSingle();
      
    let guest_id;
    if (existing) {
      guest_id = existing.id;
    } else {
      // Create new guest record (no authentication required)
      const { data: newGuest, error: guestErr } = await supabase
        .from('photo_selection_guests')
        .insert({
          selection_id: selection.id,
          name: guestName.trim(),
          email: guestEmail.trim()
        })
        .select()
        .single();
        
      if (guestErr) throw guestErr;
      guest_id = newGuest.id;
    }
    
    setGuestId(guest_id);
    // Persist in session storage during this visit
    sessionStorage.setItem(`guest_id_${code}`, guest_id);
  } catch (err) {
    console.error('Join error', err);
    alert('Failed to join. Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

#### Favorite Selection with Limits
```typescript
const toggleFavorite = async (photoId: string) => {
  if (!selection || !guestId || selection.status !== 'pending') return;

  const isFav = favorites.some(f => f.photo_id === photoId && f.guest_id === guestId);
  
  // Check if adding would exceed limit
  const uniqueFavs = new Set(favorites.map(f => f.photo_id));
  if (!isFav && uniqueFavs.size >= selection.max_photos && !uniqueFavs.has(photoId)) {
    alert(`You've already selected the maximum of ${selection.max_photos} photos.`);
    return;
  }

  try {
    // Optimistic update
    if (isFav) {
      // Remove favorite
      setFavorites(prev => prev.filter(f => !(
        f.photo_id === photoId && f.guest_id === guestId
      )));
      await supabase
        .from('photo_favorites')
        .delete()
        .match({ 
          selection_id: selection.id, 
          photo_id: photoId, 
          guest_id: guestId 
        });
    } else {
      // Add favorite
      setFavorites(prev => [...prev, { photo_id: photoId, guest_id: guestId }]);
      await supabase
        .from('photo_favorites')
        .insert({ 
          selection_id: selection.id, 
          photo_id: photoId, 
          guest_id: guestId 
        });
    }
    
    // Reload to sync with other participants
    loadFavorites(selection.id);
  } catch (err) {
    console.error(err);
    loadFavorites(selection.id); // Revert on error
  }
};
```

#### Final Selection Submission
```typescript
const handleSubmitSelections = async () => {
  if (!selection) return;
  const uniqueFavs = new Set(favorites.map(f => f.photo_id));
  
  if (uniqueFavs.size !== selection.max_photos) {
    alert(`Please select exactly ${selection.max_photos} photos before submitting.`);
    return;
  }
  
  if (confirm('Are you sure you want to finalize and submit these selections to the photographer? This cannot be undone.')) {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('photo_selections')
        .update({ status: 'submitted' })
        .eq('id', selection.id);
        
      if (error) throw error;
      setSelection({ ...selection, status: 'submitted' });
    } catch (err) {
      console.error(err);
      alert('Failed to submit selections.');
    } finally {
      setSubmitting(false);
    }
  }
};
```

#### Comparison Mode
```typescript
const [isCompareMode, setIsCompareMode] = useState(false);
const [comparePhotos, setComparePhotos] = useState<string[]>([]);

// Side-by-side comparison of selected photos
const toggleCompare = (photoId: string) => {
  setComparePhotos(prev => 
    prev.includes(photoId) 
      ? prev.filter(id => id !== photoId)
      : [...prev, photoId]
  );
};
```

### **Booking Flow Component**

#### Package/Service Selection
```typescript
export function BookingFlow() {
  const { packageId } = useParams();
  const [pkg, setPkg] = useState<any>(null);
  const [photographer, setPhotographer] = useState<any>(null);
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      // Get package details
      const { data: pkgData, error: pkgError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError) throw pkgError;
      setPkg(pkgData);

      // Get photographer details
      if (pkgData) {
        const { data: photoData, error: photoError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', pkgData.photographer_id)
          .single();

        if (photoError) throw photoError;
        setPhotographer(photoData);
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
    } finally {
      setLoading(false);
    }
  };
}
```

#### Booking Form & Payment Options
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.event_date || !formData.location) return;

  try {
    setSubmitting(true);
    const amountToPay = paymentType === 'deposit' ? pkg.price * 0.2 : pkg.price;

    // TODO: INTEGRATE RAZORPAY
    const options = {
      key: 'YOUR_RAZORPAY_KEY_ID',
      amount: amountToPay * 100, // Amount in paise
      currency: 'INR',
      name: 'PixEvent',
      description: `Booking: ${pkg.title}`,
      handler: async function (response: any) {
        // Verify payment and save booking
        await saveBooking();
      },
      prefill: {
        name: user?.user_metadata?.full_name || '',
        email: user?.email || '',
      },
      theme: {
        color: '#ff4b4b'
      }
    };

    if (window.Razorpay) {
      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } else {
      // Fallback: save without payment
      await saveBooking();
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
  }
};

const saveBooking = async () => {
  try {
    const { error } = await supabase
      .from('bookings')
      .insert([{
        photographer_id: pkg.photographer_id,
        client_id: user?.id,
        package_id: pkg.id,
        event_date: formData.event_date,
        location: formData.location,
        notes: formData.notes,
        total_amount: pkg.price,
        status: 'pending'
      }]);

    if (error) throw error;
    setSuccess(true);
  } catch (error) {
    console.error('Error creating booking:', error);
    alert('There was an error creating your booking. Please try again.');
  }
};
```

### **Photo Service Utilities**

#### Fetch Event Photos
```typescript
export async function fetchEventPhotos(
    eventId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: PhotoFilters
): Promise<PaginatedPhotos> {
    try {
        let query = supabase
            .from('photos')
            .select('*', { count: 'exact' })
            .eq('event_id', eventId)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (filters?.search) {
            query = query.ilike('file_name', `%${filters.search}%`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        // Generate public URLs for each photo
        const photosWithUrls = await Promise.all(
            (data || []).map(async (photo) => {
                const { data: urlData } = supabase.storage
                    .from('photos')
                    .getPublicUrl(photo.file_path);

                return {
                    ...photo,
                    url: urlData.publicUrl,
                    thumbnail: urlData.publicUrl,
                };
            })
        );

        return {
            photos: photosWithUrls,
            totalCount: count || 0,
            hasMore: (count || 0) > page * pageSize,
        };
    } catch (error) {
        console.error('Error in fetchEventPhotos:', error);
        throw error;
    }
}
```

#### Download Single & Multiple Photos
```typescript
export async function downloadPhoto(photo: Photo): Promise<void> {
    try {
        const response = await fetch(photo.url!);
        const blob = await response.blob();

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = photo.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error downloading photo:', error);
        throw error;
    }
}

export async function downloadPhotosAsZip(
    photos: Photo[],
    zipFileName: string = 'photos.zip'
): Promise<void> {
    try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        const fetchPromises = photos.map(async (photo, index) => {
            try {
                const response = await fetch(photo.url!);
                const blob = await response.blob();
                zip.file(photo.file_name, blob);
            } catch (error) {
                console.error(`Error fetching photo ${photo.file_name}:`, error);
            }
        });

        await Promise.all(fetchPromises);

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error creating ZIP:', error);
        throw error;
    }
}
```

### **Capabilities**
✅ **Shareable portal links**: Selection code-based access (no authentication)  
✅ **Multi-guest collaboration**: Multiple people can view and select from same portal  
✅ **Photo limits**: Configurable max photos per selection (e.g., 50 favorite photos)  
✅ **Guest registration**: Anonymous guest entry with name/email tracking  
✅ **Per-guest tracking**: Each guest's selections tracked separately  
✅ **Session persistence**: Guest ID stored in sessionStorage for return visits  
✅ **Favorite toggling**: Add/remove favorites with real-time UI updates  
✅ **Photo comparison**: Side-by-side comparison mode for selected photos  
✅ **Submission workflow**: Finalize selections with confirmation dialog  
✅ **Photo filtering**: Only edited photos shown to clients  
✅ **Pagination support**: Handles large photo galleries with page sizes  
✅ **Search functionality**: Search photos by filename  
✅ **Single & batch download**: Download individual or multiple photos as ZIP  
✅ **Booking integration**: Package-based booking with deposit/full payment options  
✅ **Payment-ready**: Razorpay integration scaffolding (awaiting configuration)  

### **Limitations**
❌ **No real-time sync**: Changes by one guest don't instantly show to others  
❌ **No shared voting**: Can't see other guests' current selections  
❌ **Limited guest hierarchy**: All guests have same permissions/UI  
❌ **Payment incomplete**: Razorpay integration has placeholder keys  
❌ **No price customization**: Package price from database; no dynamic pricing  
❌ **Status management weak**: Portal status tracked but UI doesn't reflect deadlines  
❌ **No email notifications**: Guests aren't notified when portal opens/deadline approaches  
❌ **No automatic approval**: Guest uploads still require manual approval  
❌ **No download statistics**: No tracking of which photos were downloaded  
❌ **No comparison history**: Comparison mode is session-only; no persistence  
❌ **Limited metadata**: No photo descriptions, photographer notes visible to clients  

---

## Summary Table

| Feature | Files | Status | Key Capability | Main Gap |
|---------|-------|--------|-----------------|----------|
| **Camera Sync** | cameraSync.ts, CameraSync.tsx, uploadManager.ts | ⚠️ Partial | WiFi camera auto-upload | Phone camera not implemented |
| **Face Detection** | faceApi.ts, SelfieCapture.tsx | ✅ Complete | 128D descriptor extraction | No comparison/matching logic |
| **Client Selection** | SelectionPortal.tsx, BookingFlow.tsx, photoService.ts | ✅ Complete | Shareable portals, favorites, booking | No real-time collaboration |

---

## Database Schema Integration

Key tables referenced:
- `photo_selections`: Portal configuration (max_photos, status, deadline)
- `photo_selection_guests`: Guest registry (name, email per portal)
- `photo_favorites`: Guest selections (photo_id, guest_id, selection_id)
- `photo_faces`: Extracted face descriptors (photo_id, face_descriptor)
- `photos`: Photo metadata (file_path, is_edited, width, height)
- `bookings`: Booking records (photographer_id, client_id, status)
- `packages`: Service packages (price, photographer_id)

