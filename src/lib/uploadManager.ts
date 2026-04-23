import { supabase } from './supabaseClient';
import { compressImage, CompressedImage, getImageDimensions } from './imageCompression';
import { faceEngine } from './faceEngine';


export interface UploadFile {
  id: string;
  file: File;
  compressedFile?: File;
  preview: string;
  progress: number;
  status: 'pending' | 'compressing' | 'uploading' | 'saving' | 'completed' | 'error';
  error?: string;
  originalSize: number;
  compressedSize?: number;
  width?: number;
  height?: number;
}

export interface UploadProgress {
  fileId: string;
  progress: number;
  status: UploadFile['status'];
  error?: string;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  photoId?: string;
  error?: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;
export type CompleteCallback = (result: UploadResult) => void;

/**
 * Upload manager for handling parallel uploads with queue
 */
export class UploadManager {
  private files: Map<string, UploadFile> = new Map();
  private uploadQueue: string[] = [];
  private activeUploads: number = 0;
  private maxConcurrent: number = 3;
  private onProgress?: ProgressCallback;
  private onComplete?: CompleteCallback;
  private eventId?: string;
  private fastSelectionId?: string;
  private sessionToken?: string;
  private uploaderId?: string;
  private isGuestUpload: boolean;
  private isEdited: boolean;
  private skipCompression: boolean;

  constructor(
    options: {
      eventId?: string;
      fastSelectionId?: string;
      maxConcurrent?: number;
      sessionToken?: string;
      uploaderId?: string;
      isGuestUpload?: boolean;
      isEdited?: boolean;
      skipCompression?: boolean;
      onProgress?: ProgressCallback;
      onComplete?: CompleteCallback;
    } = {}
  ) {
    this.eventId = options.eventId;
    this.fastSelectionId = options.fastSelectionId;
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.sessionToken = options.sessionToken;
    this.uploaderId = options.uploaderId;
    this.isGuestUpload = options.isGuestUpload ?? false;
    this.isEdited = options.isEdited ?? false;
    this.skipCompression = options.skipCompression ?? false;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
  }

  /**
   * Add files to the upload queue
   */
  addFiles(files: File[]): UploadFile[] {
    const uploadFiles: UploadFile[] = [];

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preview = URL.createObjectURL(file);

      const uploadFile: UploadFile = {
        id,
        file,
        preview,
        progress: 0,
        status: 'pending',
        originalSize: file.size,
      };

      this.files.set(id, uploadFile);
      uploadFiles.push(uploadFile);
    }

    return uploadFiles;
  }

  /**
   * Remove a file from the upload queue
   */
  removeFile(fileId: string): boolean {
    const file = this.files.get(fileId);
    if (file) {
      URL.revokeObjectURL(file.preview);
      this.files.delete(fileId);
      this.uploadQueue = this.uploadQueue.filter(id => id !== fileId);
      return true;
    }
    return false;
  }

  /**
   * Clear all files
   */
  clearFiles(): void {
    for (const file of this.files.values()) {
      URL.revokeObjectURL(file.preview);
    }
    this.files.clear();
    this.uploadQueue = [];
  }

  /**
   * Get all files
   */
  getFiles(): UploadFile[] {
    return Array.from(this.files.values());
  }

  /**
   * Get a specific file
   */
  getFile(fileId: string): UploadFile | undefined {
    return this.files.get(fileId);
  }

  /**
   * Start uploading all pending files
   */
  async startUpload(): Promise<void> {
    const pendingFiles = Array.from(this.files.values()).filter(
      f => f.status === 'pending'
    );

    // Add to queue
    for (const file of pendingFiles) {
      if (!this.uploadQueue.includes(file.id)) {
        this.uploadQueue.push(file.id);
      }
    }

    // Start processing queue
    this.processQueue();
  }

  /**
   * Cancel all uploads
   */
  cancelUploads(): void {
    this.uploadQueue = [];
    for (const file of this.files.values()) {
      if (file.status === 'uploading' || file.status === 'compressing') {
        file.status = 'pending';
        file.progress = 0;
        this.onProgress?.({
          fileId: file.id,
          progress: 0,
          status: 'pending',
        });
      }
    }
  }

  /**
   * Process the upload queue
   */
  private async processQueue(): Promise<void> {
    while (this.uploadQueue.length > 0 && this.activeUploads < this.maxConcurrent) {
      const fileId = this.uploadQueue.shift();
      if (!fileId) continue;

      const file = this.files.get(fileId);
      if (!file || file.status !== 'pending') continue;

      this.activeUploads++;
      this.uploadFile(file).finally(() => {
        this.activeUploads--;
        this.processQueue();
      });
    }
  }

  /**
   * Upload a single file
   */
  private async uploadFile(uploadFile: UploadFile): Promise<void> {
    try {
      if (this.skipCompression) {
        // Skip compression, just get dimensions
        const dims = await getImageDimensions(uploadFile.file);
        uploadFile.compressedFile = uploadFile.file;
        uploadFile.compressedSize = uploadFile.file.size;
        uploadFile.width = dims.width;
        uploadFile.height = dims.height;
      } else {
        const compressed = await compressImage(uploadFile.file, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.85,
        });

        uploadFile.compressedFile = compressed.file;
        uploadFile.compressedSize = compressed.compressedSize;
        uploadFile.width = compressed.width;
        uploadFile.height = compressed.height;
      }

      // Step 2: Upload to Supabase Storage
      uploadFile.status = 'uploading';
      uploadFile.progress = 10;
      this.onProgress?.({
        fileId: uploadFile.id,
        progress: 10,
        status: 'uploading',
      });

      const filePath = await this.uploadToStorage(uploadFile);

      // Step 3: Save metadata to database
      uploadFile.status = 'saving';
      uploadFile.progress = 90;
      this.onProgress?.({
        fileId: uploadFile.id,
        progress: 90,
        status: 'saving',
      });

      const photoId = await this.savePhotoMetadata(uploadFile, filePath);

      // Step 3.5: Client-side AI face indexing (Instant)
      try {
        const img = new Image();
        img.src = URL.createObjectURL(uploadFile.file);
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        await faceEngine.extractAndStoreFaces(img, photoId, this.eventId || '', !!this.fastSelectionId);
        URL.revokeObjectURL(img.src);
      } catch (faceErr) {
        console.error("Browser-side AI face indexing failed:", faceErr);
      }

      // Step 4: Complete
      uploadFile.status = 'completed';
      uploadFile.progress = 100;
      this.onProgress?.({
        fileId: uploadFile.id,
        progress: 100,
        status: 'completed',
      });

      this.onComplete?.({
        success: true,
        fileId: uploadFile.id,
        photoId,
      });
    } catch (error) {
      uploadFile.status = 'error';
      uploadFile.error = (error as Error).message;
      this.onProgress?.({
        fileId: uploadFile.id,
        progress: uploadFile.progress,
        status: 'error',
        error: (error as Error).message,
      });

      this.onComplete?.({
        success: false,
        fileId: uploadFile.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadToStorage(uploadFile: UploadFile): Promise<string> {
    const file = uploadFile.compressedFile || uploadFile.file;
    const fileExt = file.name.split('.').pop();
    const folder = this.eventId ? `events/${this.eventId}` : `selections/${this.fastSelectionId}`;
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Simulate progress for upload (since Supabase doesn't provide progress)
    for (let progress = 10; progress <= 85; progress += 5) {
      uploadFile.progress = progress;
      this.onProgress?.({
        fileId: uploadFile.id,
        progress,
        status: 'uploading',
      });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return fileName;
  }

  /**
   * Save photo metadata to database
   */
  private async savePhotoMetadata(uploadFile: UploadFile, filePath: string): Promise<string> {
    const file = uploadFile.compressedFile || uploadFile.file;

    const { data, error } = await supabase
      .from(this.fastSelectionId ? 'fast_selection_photos' : 'photos')
      .insert({
        [this.fastSelectionId ? 'session_id' : 'event_id']: this.fastSelectionId || this.eventId,
        uploader_id: this.uploaderId || null,
        upload_session_id: this.sessionToken || null,
        file_name: file.name,
        file_path: filePath,
        file_size: uploadFile.compressedSize || uploadFile.originalSize,
        file_type: file.type,
        width: uploadFile.width || 0,
        height: uploadFile.height || 0,
        ...(!this.fastSelectionId ? {
          is_approved: !this.isGuestUpload, // Auto-approve owner uploads
          is_guest_upload: this.isGuestUpload,
          is_edited: this.isEdited,
        } : {})
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save metadata: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get upload statistics
   */
  getStats(): {
    total: number;
    pending: number;
    compressing: number;
    uploading: number;
    saving: number;
    completed: number;
    error: number;
    totalSize: number;
    compressedSize: number;
  } {
    const files = Array.from(this.files.values());
    return {
      total: files.length,
      pending: files.filter(f => f.status === 'pending').length,
      compressing: files.filter(f => f.status === 'compressing').length,
      uploading: files.filter(f => f.status === 'uploading').length,
      saving: files.filter(f => f.status === 'saving').length,
      completed: files.filter(f => f.status === 'completed').length,
      error: files.filter(f => f.status === 'error').length,
      totalSize: files.reduce((sum, f) => sum + f.originalSize, 0),
      compressedSize: files.reduce((sum, f) => sum + (f.compressedSize || f.originalSize), 0),
    };
  }
}
