import { supabase } from './supabaseClient';
import { azureStorageProvider } from './providers/azureStorageProvider';

export interface PhotoMetadata {
  id: string;
  event_id: string;
  uploader_id: string | null;
  upload_session_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  width: number;
  height: number;
  thumbnail_url: string | null;
  is_approved: boolean;
  is_guest_upload: boolean;
  uploaded_at?: string;
  created_at: string;
  processing_status?: 'pending' | 'processing' | 'ready' | 'failed';
}

export interface CreatePhotoMetadata {
  event_id: string;
  uploader_id?: string | null;
  upload_session_id?: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  width?: number;
  height?: number;
  is_approved?: boolean;
  is_guest_upload?: boolean;
  processing_status?: 'pending' | 'processing' | 'ready' | 'failed';
}

/**
 * Save photo metadata to database
 */
export async function savePhotoMetadata(
  metadata: CreatePhotoMetadata
): Promise<{ success: boolean; photoId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .insert({
        event_id: metadata.event_id,
        uploader_id: metadata.uploader_id || null,
        upload_session_id: metadata.upload_session_id || null,
        file_name: metadata.file_name,
        file_path: metadata.file_path,
        file_size: metadata.file_size,
        file_type: metadata.file_type,
        width: metadata.width || 0,
        height: metadata.height || 0,
        is_approved: metadata.is_approved ?? true,
        is_guest_upload: metadata.is_guest_upload ?? false,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, photoId: data.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get photos by event ID
 */
export async function getPhotosByEventId(
  eventId: string,
  options: {
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at';
    order?: 'asc' | 'desc';
  } = {}
): Promise<{ success: boolean; photos?: PhotoMetadata[]; error?: string }> {
  try {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      order = 'desc',
    } = options;

    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', eventId)
      .order(orderBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, photos: data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get photo by ID
 */
export async function getPhotoById(
  photoId: string
): Promise<{ success: boolean; photo?: PhotoMetadata; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, photo: data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Update photo metadata
 */
export async function updatePhotoMetadata(
  photoId: string,
  updates: Partial<CreatePhotoMetadata>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('photos')
      .update(updates)
      .eq('id', photoId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Delete photo
 */
export async function deletePhoto(
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the photo to get the file path
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('file_path')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') return { success: true }; // Already deleted
      return { success: false, error: fetchError.message };
    }

    // Delete from Azure storage (using deleteIfExists to avoid errors)
    const storageResult = await azureStorageProvider.deleteFile(photo.file_path, 'photos');

    if (!storageResult.success) {
      console.error('Error deleting from Azure storage:', storageResult.error);
    }

    // Also attempt to delete from Supabase storage in case it's an old file
    try {
      await supabase.storage.from('photos').remove([photo.file_path]);
    } catch (supabaseErr) {
      console.error('Error deleting from Supabase storage:', supabaseErr);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get photo count by event ID
 */
export async function getPhotoCountByEventId(
  eventId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get public URL for a photo
 */
export function getPhotoPublicUrl(filePath: string): string {
  return azureStorageProvider.getBlobUrl(filePath, 'photos');
}

/**
 * Approve or reject a guest photo
 */
export async function approvePhoto(
  photoId: string,
  isApproved: boolean
): Promise<{ success: boolean; error?: string }> {
  return updatePhotoMetadata(photoId, { is_approved: isApproved });
}

