import { supabase } from './supabaseClient';

/**
 * Ensures a photo selection portal exists for the given event.
 * If it doesn't exist, it creates one with default settings.
 */
export async function ensurePhotoSelectionPortal(eventId: string) {
  try {
    // 1. Check if portal already exists
    const { data: existing, error: fetchError } = await supabase
      .from('photo_selections')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking photo selection portal:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (existing) {
      return { success: true, id: existing.id, isNew: false };
    }

    // 2. Create new portal record — only columns that exist in the DB
    const { data: newPortal, error: createError } = await supabase
      .from('photo_selections')
      .insert({
        event_id: eventId,
        status: 'pending',
        max_photos: 100,
        selection_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating photo selection portal:', createError);
      return { success: false, error: createError.message };
    }

    return { success: true, id: newPortal.id, isNew: true };
  } catch (error) {
    console.error('Exception in ensurePhotoSelectionPortal:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Marks all existing photos for an event as included in the selection pool.
 */
export async function syncAllPhotosToSelectionPool(eventId: string) {
  try {
    const { error } = await supabase
      .from('photos')
      .update({ is_in_selection_pool: true })
      .eq('event_id', eventId);

    if (error) {
      console.error('Error syncing photos to selection pool:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception in syncAllPhotosToSelectionPool:', error);
    return { success: false, error: (error as Error).message };
  }
}
