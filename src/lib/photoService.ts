import { supabase } from './supabaseClient';
import { azureStorageProvider } from './providers/azureStorageProvider';

export interface Photo {
    id: string;
    event_id: string;
    uploader_id: string | null;
    upload_session_id: string | null;
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string;
    width: number | null;
    height: number | null;
    thumbnail_url: string | null;
    is_approved: boolean;
    is_guest_upload: boolean;
    uploaded_at?: string;
    created_at: string;
    url?: string;
    thumbnail?: string;
}

export interface PhotoFilters {
    category?: string;
    search?: string;
}

export interface PaginatedPhotos {
    photos: Photo[];
    totalCount: number;
    hasMore: boolean;
}

/**
 * Fetch photos for an event with pagination
 */
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

        // Apply search filter if provided
        if (filters?.search) {
            query = query.ilike('file_name', `%${filters.search}%`);
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching photos:', error);
            throw error;
        }

        // Generate public URLs for each photo
        const photosWithUrls = await Promise.all(
            (data || []).map(async (photo) => {
                const publicUrl = azureStorageProvider.getBlobUrl(photo.file_path);

                // Generate thumbnail URL (same as full URL for now, can be optimized later)
                const thumbnailUrl = publicUrl;

                return {
                    ...photo,
                    url: publicUrl,
                    thumbnail: thumbnailUrl,
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

/**
 * Get a single photo by ID
 */
export async function getPhotoById(photoId: string): Promise<Photo | null> {
    try {
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('id', photoId)
            .single();

        if (error) {
            console.error('Error fetching photo:', error);
            throw error;
        }

        if (!data) return null;

        const publicUrl = azureStorageProvider.getBlobUrl(data.file_path);

        return {
            ...data,
            url: publicUrl,
            thumbnail: publicUrl,
        };
    } catch (error) {
        console.error('Error in getPhotoById:', error);
        throw error;
    }
}

/**
 * Download a single photo
 */
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

/**
 * Download multiple photos as ZIP
 */
export async function downloadPhotosAsZip(
    photos: Photo[],
    zipFileName: string = 'photos.zip'
): Promise<void> {
    try {
        // Dynamically import JSZip
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Fetch all photos and add to ZIP
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

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Download ZIP
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

/**
 * Get event details including photo count
 */
export async function getEventDetails(eventId: string) {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error) {
            console.error('Error fetching event:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in getEventDetails:', error);
        throw error;
    }
}

