import { supabase } from './supabaseClient';
import { UploadManager } from './uploadManager';

export type CameraType = 'canon' | 'sony' | 'nikon' | 'phone';

export interface CameraConfig {
    type: CameraType;
    ipAddress?: string;
    port?: number;
    apiKey?: string;
    autoConnect?: boolean;
}

export interface CameraSyncStats {
    totalSynced: number;
    totalFailed: number;
    lastSyncTime: string | null;
    isRunning: boolean;
    currentCamera: CameraType | null;
}

export interface SyncedPhoto {
    id: string;
    fileName: string;
    filePath: string;
    thumbnailUrl: string;
    uploadedAt: string;
}

/**
 * Camera Sync Service
 * Handles automatic photo sync from WiFi-enabled cameras
 */
export class CameraSyncService {
    private config: CameraConfig;
    private eventId: string;
    private uploaderId: string;
    private isRunning: boolean = false;
    private uploadManager: UploadManager;
    private syncInterval: NodeJS.Timeout | null = null;
    private stats: CameraSyncStats;
    private syncedPhotoIds: Set<string> = new Set();
    private onStatsUpdate?: (stats: CameraSyncStats) => void;
    private onPhotoSynced?: (photo: SyncedPhoto) => void;
    private onError?: (error: string) => void;

    constructor(
        config: CameraConfig,
        eventId: string,
        uploaderId: string,
        options: {
            onStatsUpdate?: (stats: CameraSyncStats) => void;
            onPhotoSynced?: (photo: SyncedPhoto) => void;
            onError?: (error: string) => void;
        } = {}
    ) {
        this.config = config;
        this.eventId = eventId;
        this.uploaderId = uploaderId;
        this.onStatsUpdate = options.onStatsUpdate;
        this.onPhotoSynced = options.onPhotoSynced;
        this.onError = options.onError;

        this.stats = {
            totalSynced: 0,
            totalFailed: 0,
            lastSyncTime: null,
            isRunning: false,
            currentCamera: config.type
        };

        this.uploadManager = new UploadManager({
            eventId: eventId,
            maxConcurrent: 50,
            uploaderId: uploaderId,
            isGuestUpload: false,
            isInSelectionPool: true,
            onProgress: (progress) => {
                // Progress updates handled by upload manager
            },
            onComplete: (result) => {
                if (result.success) {
                    this.stats.totalSynced++;
                    this.stats.lastSyncTime = new Date().toISOString();
                    this.onStatsUpdate?.(this.stats);
                } else {
                    this.stats.totalFailed++;
                    this.onError?.(result.error || 'Upload failed');
                }
            }
        });
    }

    /**
     * Start camera sync
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('Camera sync already running');
            return;
        }

        try {
            this.isRunning = true;
            this.stats.isRunning = true;
            this.onStatsUpdate?.(this.stats);

            console.log(`Starting camera sync for ${this.config.type}...`);

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

            console.log('Camera sync started successfully');
        } catch (error) {
            this.isRunning = false;
            this.stats.isRunning = false;
            this.onStatsUpdate?.(this.stats);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.onError?.(errorMessage);
            throw error;
        }
    }

    /**
     * Stop camera sync
     */
    async stop(): Promise<void> {
        this.isRunning = false;
        this.stats.isRunning = false;

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        this.onStatsUpdate?.(this.stats);
        console.log('Camera sync stopped');
    }

    /**
     * Test camera connection
     */
    async testConnection(): Promise<boolean> {
        try {
            switch (this.config.type) {
                case 'canon':
                    return await this.testCanonConnection();
                case 'sony':
                    return await this.testSonyConnection();
                case 'nikon':
                    return await this.testNikonConnection();
                case 'phone':
                    return true; // Phone always connected
                default:
                    return false;
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    /**
     * Sync photos from camera
     */
    private async syncPhotos(): Promise<void> {
        if (!this.isRunning) return;

        try {
            let newPhotos: File[] = [];

            switch (this.config.type) {
                case 'canon':
                    newPhotos = await this.fetchCanonPhotos();
                    break;
                case 'sony':
                    newPhotos = await this.fetchSonyPhotos();
                    break;
                case 'nikon':
                    newPhotos = await this.fetchNikonPhotos();
                    break;
                case 'phone':
                    newPhotos = await this.fetchPhonePhotos();
                    break;
            }

            if (newPhotos.length > 0) {
                console.log(`Found ${newPhotos.length} new photos to sync`);
                const uploadFiles = this.uploadManager.addFiles(newPhotos);
                await this.uploadManager.startUpload();

                // Notify about synced photos
                for (const file of uploadFiles) {
                    this.onPhotoSynced?.({
                        id: file.id,
                        fileName: file.file.name,
                        filePath: file.id,
                        thumbnailUrl: file.preview,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error('Error syncing photos:', error);
            this.stats.totalFailed++;
            this.onError?.(error instanceof Error ? error.message : 'Sync failed');
        }
    }

    // ==================== CANON CAMERA API ====================

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

    // ==================== SONY CAMERA API ====================

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

    private async fetchSonyPhotos(): Promise<File[]> {
        const photos: File[] = [];
        const baseUrl = `http://${this.config.ipAddress}:${this.config.port || 8080}`;

        try {
            // Get list of available content from Sony API
            const response = await fetch(`${baseUrl}/sony/camera`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method: 'getContentList',
                    params: ['flat'],
                    id: 1,
                    version: '1.0'
                })
            });

            if (!response.ok) {
                throw new Error(`Sony API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.result && data.result[0]) {
                const contents = data.result[0];

                for (const content of contents) {
                    // Skip if already synced
                    if (this.syncedPhotoIds.has(content.content)) continue;

                    // Only process images
                    if (content.content && content.content.includes('.JPG')) {
                        try {
                            const photoResponse = await fetch(`${baseUrl}${content.content}`);
                            if (photoResponse.ok) {
                                const blob = await photoResponse.blob();
                                const fileName = content.content.split('/').pop() || 'photo.jpg';
                                const file = new File([blob], fileName, { type: 'image/jpeg' });
                                photos.push(file);
                                this.syncedPhotoIds.add(content.content);
                            }
                        } catch (error) {
                            console.error(`Failed to fetch Sony photo ${content.content}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching Sony photos:', error);
            throw error;
        }

        return photos;
    }

    // ==================== NIKON CAMERA API ====================

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

    private async fetchNikonPhotos(): Promise<File[]> {
        const photos: File[] = [];
        const baseUrl = `http://${this.config.ipAddress}:${this.config.port || 8080}`;

        try {
            // Get list of photos from Nikon API
            const response = await fetch(`${baseUrl}/api/photos`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Nikon API error: ${response.status}`);
            }

            const data = await response.json();

            for (const photo of data.photos || []) {
                // Skip if already synced
                if (this.syncedPhotoIds.has(photo.id)) continue;

                try {
                    const photoResponse = await fetch(`${baseUrl}${photo.url}`);
                    if (photoResponse.ok) {
                        const blob = await photoResponse.blob();
                        const fileName = photo.name || `nikon_${photo.id}.jpg`;
                        const file = new File([blob], fileName, { type: 'image/jpeg' });
                        photos.push(file);
                        this.syncedPhotoIds.add(photo.id);
                    }
                } catch (error) {
                    console.error(`Failed to fetch Nikon photo ${photo.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error fetching Nikon photos:', error);
            throw error;
        }

        return photos;
    }

    // ==================== PHONE CAMERA ====================

    private async fetchPhonePhotos(): Promise<File[]> {
        // For phone camera, we'll use file system monitoring
        // This would be implemented in a native mobile app
        // For web, we can use the File System Access API
        const photos: File[] = [];

        try {
            // Check if File System Access API is available
            if ('showDirectoryPicker' in window) {
                // This would be triggered by user selecting a folder
                // For now, return empty array
                console.log('Phone camera sync requires native app implementation');
            }
        } catch (error) {
            console.error('Error fetching phone photos:', error);
        }

        return photos;
    }

    /**
     * Get current stats
     */
    getStats(): CameraSyncStats {
        return { ...this.stats };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<CameraConfig>): void {
        this.config = { ...this.config, ...config };
        this.stats.currentCamera = this.config.type;
    }

    /**
     * Clear synced photo cache
     */
    clearCache(): void {
        this.syncedPhotoIds.clear();
    }
}

/**
 * Save camera sync settings to database
 */
export async function saveCameraSyncSettings(
    eventId: string,
    config: CameraConfig
): Promise<void> {
    const { error } = await supabase
        .from('events')
        .update({
            camera_sync_config: config,
            camera_sync_enabled: true
        })
        .eq('id', eventId);

    if (error) {
        throw new Error(`Failed to save camera sync settings: ${error.message}`);
    }
}

/**
 * Load camera sync settings from database
 */
export async function loadCameraSyncSettings(
    eventId: string
): Promise<CameraConfig | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (error || !data?.camera_sync_enabled) {
        return null;
    }

    return data.camera_sync_config as CameraConfig;
}

