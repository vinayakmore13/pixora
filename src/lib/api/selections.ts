/**
 * Selection Portal API - CRUD Operations
 * Handles all photo selection, download tracking, and guest management
 */

import { supabase } from '../supabaseClient';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SelectionConfig {
  id: string;
  event_id: string;
  photographer_id: string;
  selection_code: string;
  max_photos: number;
  status: 'active' | 'closed' | 'expired' | 'archived';
  is_collaborative: boolean;
  allow_comments: boolean;
  allow_voting: boolean;
  photographer_notes?: string;
  cover_photo_id?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SelectionGuest {
  id: string;
  selection_id: string;
  email: string;
  name: string;
  status: 'invited' | 'accepted' | 'submitted';
  selected_count?: number;
  last_activity: string;
  is_active: boolean;
  device_info?: Record<string, any>;
  submitted_at?: string;
}

export interface SelectionPhoto {
  id: string;
  url: string;
  thumbnail_url: string;
  selection_count: number;
  selected_by_me: boolean;
  category?: string;
  metadata?: Record<string, any>;
}

export interface SelectionDownload {
  id: string;
  selection_id: string;
  photo_count: number;
  format: 'original' | 'high_res' | 'web';
  download_url: string;
  expires_at: string;
  file_size_mb: number;
  accessed?: boolean;
}

export interface SelectionNotification {
  id: string;
  selection_id: string;
  recipient_email: string;
  notification_type: 'invite' | 'reminder' | 'ready' | 'thank_you';
  status: 'pending' | 'sent' | 'failed' | 'opened' | 'clicked';
  sent_at?: string;
  opened_at?: string;
}

// ============================================================================
// A. SELECTION MANAGEMENT ENDPOINTS (5)
// ============================================================================

/**
 * A1. Create new selection portal
 */
export async function createSelection(params: {
  event_id: string;
  photographer_id: string;
  max_photos: number;
  is_collaborative?: boolean;
  expires_at?: string;
  photographer_notes?: string;
}): Promise<SelectionConfig> {
  try {
    // Generate unique selection code
    const selection_code = Math.random().toString(36).substring(2, 12).toUpperCase();

    const { data, error } = await supabase
      .from('photo_selections')
      .insert({
        event_id: params.event_id,
        photographer_id: params.photographer_id,
        selection_code,
        max_photos: params.max_photos,
        is_collaborative: params.is_collaborative ?? true,
        expires_at: params.expires_at,
        photographer_notes: params.photographer_notes,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating selection:', error);
    throw error;
  }
}

/**
 * A2. Get selection configuration and stats
 */
export async function getSelection(selectionId: string): Promise<SelectionConfig & { guest_count: number; submitted_count: number }> {
  try {
    const { data: selection, error: selectionError } = await supabase
      .from('photo_selections')
      .select('*')
      .eq('id', selectionId)
      .single();

    if (selectionError) throw selectionError;

    // Get guest stats
    const { data: guests, error: guestError } = await supabase
      .from('photo_selection_guests')
      .select('id, status')
      .eq('selection_id', selectionId);

    if (guestError) throw guestError;

    const guest_count = guests?.length || 0;
    const submitted_count = guests?.filter((g) => g.status === 'submitted').length || 0;

    return {
      ...selection,
      guest_count,
      submitted_count,
    };
  } catch (error) {
    console.error('Error fetching selection:', error);
    throw error;
  }
}

/**
 * A3. Update selection configuration
 */
export async function updateSelection(
  selectionId: string,
  updates: Partial<Pick<SelectionConfig, 'status' | 'expires_at' | 'photographer_notes'>>,
): Promise<SelectionConfig> {
  try {
    const { data, error } = await supabase
      .from('photo_selections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating selection:', error);
    throw error;
  }
}

/**
 * A4. Get all guest selections for a selection (what each guest selected)
 */
export async function getGuestSelections(selectionId: string): Promise<
  {
    guest_id: string;
    guest_name: string;
    guest_email: string;
    selections: Array<{ photo_id: string; selected_at: string }>;
    selected_count: number;
    submitted_at?: string;
  }[]
> {
  try {
    // Get all guests
    const { data: guests, error: guestError } = await supabase
      .from('photo_selection_guests')
      .select('id, name, email, submitted_at, status')
      .eq('selection_id', selectionId);

    if (guestError) throw guestError;

    // Get selections for each guest
    const guestSelections = await Promise.all(
      guests!.map(async (guest) => {
        const { data: selections, error: selectError } = await supabase
          .from('selection_guest_selections')
          .select('photo_id, selected_at')
          .eq('guest_id', guest.id);

        if (selectError) throw selectError;

        return {
          guest_id: guest.id,
          guest_name: guest.name,
          guest_email: guest.email,
          selections: selections || [],
          selected_count: selections?.length || 0,
          submitted_at: guest.submitted_at,
        };
      }),
    );

    return guestSelections;
  } catch (error) {
    console.error('Error fetching guest selections:', error);
    throw error;
  }
}

/**
 * A5. Delete/archive selection
 */
export async function deleteSelection(selectionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('photo_selections')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', selectionId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting selection:', error);
    throw error;
  }
}

// ============================================================================
// B. GUEST MANAGEMENT ENDPOINTS (3)
// ============================================================================

/**
 * B1. Get all guests in a selection
 */
export async function getSelectionGuests(selectionId: string): Promise<SelectionGuest[]> {
  try {
    const { data, error } = await supabase
      .from('photo_selection_guests')
      .select('*')
      .eq('selection_id', selectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get selection counts for each guest
    const guestsWithCounts = await Promise.all(
      (data || []).map(async (guest) => {
        const { count } = await supabase
          .from('selection_guest_selections')
          .select('*', { count: 'exact', head: true })
          .eq('guest_id', guest.id);

        return {
          ...guest,
          selected_count: count || 0,
        };
      }),
    );

    return guestsWithCounts;
  } catch (error) {
    console.error('Error fetching guests:', error);
    throw error;
  }
}

/**
 * B2. Invite guest to selection
 */
export async function inviteGuest(params: {
  selection_id: string;
  guest_name: string;
  guest_email: string;
  resend?: boolean;
}): Promise<SelectionGuest> {
  try {
    // Check if guest already invited
    if (!params.resend) {
      const { data: existing } = await supabase
        .from('photo_selection_guests')
        .select('id')
        .eq('selection_id', params.selection_id)
        .eq('email', params.guest_email)
        .single();

      if (existing) {
        return existing as SelectionGuest;
      }
    }

    // Insert new guest
    const { data, error } = await supabase
      .from('photo_selection_guests')
      .insert({
        selection_id: params.selection_id,
        name: params.guest_name,
        email: params.guest_email,
        status: 'invited',
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Trigger email notification in separate function
    // await sendNotification('invite', guest, selection)

    return data;
  } catch (error) {
    console.error('Error inviting guest:', error);
    throw error;
  }
}

/**
 * B3. Update guest status
 */
export async function updateGuestStatus(
  guestId: string,
  status: 'invited' | 'accepted' | 'submitted',
): Promise<SelectionGuest> {
  try {
    const { data, error } = await supabase
      .from('photo_selection_guests')
      .update({
        status,
        last_activity: new Date().toISOString(),
      })
      .eq('id', guestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating guest status:', error);
    throw error;
  }
}

// ============================================================================
// C. PHOTO SELECTION ENDPOINTS (3)
// ============================================================================

/**
 * C1. Get curated photos for selection with lazy pagination
 */
export async function getSelectionPhotos(
  selectionId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  photos: SelectionPhoto[];
  total: number;
  has_more: boolean;
}> {
  try {
    // Get event_id from selection
    const { data: selection, error: selectionError } = await supabase
      .from('photo_selections')
      .select('event_id')
      .eq('id', selectionId)
      .single();

    if (selectionError) throw selectionError;

    // Get photos for this event
    const offset = (page - 1) * limit;

    const { data: photos, error: photosError, count } = await supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .eq('event_id', selection.event_id)
      .eq('is_edited', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (photosError) throw photosError;

    // Get selection statistics for each photo
    const photosWithStats = await Promise.all(
      (photos || []).map(async (photo) => {
        const { count: selectionCount } = await supabase
          .from('selection_guest_selections')
          .select('*', { count: 'exact', head: true })
          .eq('photo_id', photo.id)
          .eq('selection_id', selectionId);

        return {
          id: photo.id,
          url: photo.file_path,
          thumbnail_url: photo.file_path, // TODO: Use CDN thumbnail
          selection_count: selectionCount || 0,
          selected_by_me: false, // Set based on current guest
          category: 'candid', // TODO: Extract from metadata
          metadata: photo.metadata,
        };
      }),
    );

    return {
      photos: photosWithStats,
      total: count || 0,
      has_more: offset + limit < (count || 0),
    };
  } catch (error) {
    console.error('Error fetching selection photos:', error);
    throw error;
  }
}

/**
 * C2. Guest selects a photo
 */
export async function selectPhoto(params: {
  selection_id: string;
  guest_id: string;
  photo_id: string;
}): Promise<{ success: boolean; selection_count: number; user_selection_count: number }> {
  try {
    // Insert selection
    const { error: insertError } = await supabase
      .from('selection_guest_selections')
      .insert({
        selection_id: params.selection_id,
        guest_id: params.guest_id,
        photo_id: params.photo_id,
      });

    if (insertError) {
      // Handle duplicate (already selected)
      if (insertError.code === '23505') {
        return {
          success: false,
          selection_count: 0,
          user_selection_count: 0,
        };
      }
      throw insertError;
    }

    // Get updated counts
    const { count: selectionCount } = await supabase
      .from('selection_guest_selections')
      .select('*', { count: 'exact', head: true })
      .eq('photo_id', params.photo_id)
      .eq('selection_id', params.selection_id);

    const { count: userCount } = await supabase
      .from('selection_guest_selections')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', params.guest_id);

    return {
      success: true,
      selection_count: selectionCount || 0,
      user_selection_count: userCount || 0,
    };
  } catch (error) {
    console.error('Error selecting photo:', error);
    throw error;
  }
}

/**
 * C3. Guest deselects a photo
 */
export async function deselectPhoto(params: {
  selection_id: string;
  guest_id: string;
  photo_id: string;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('selection_guest_selections')
      .delete()
      .eq('guest_id', params.guest_id)
      .eq('photo_id', params.photo_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deselecting photo:', error);
    throw error;
  }
}

// ============================================================================
// D. DOWNLOAD MANAGEMENT ENDPOINTS (2)
// ============================================================================

/**
 * D1. Generate download package
 */
export async function generateDownload(params: {
  selection_id: string;
  guest_id: string;
  photo_ids: string[];
  format: 'original' | 'high_res' | 'web';
}): Promise<SelectionDownload> {
  try {
    // Generate unique download key
    const download_key = Math.random().toString(36).substring(2, 20);

    // Calculate expiry (30 days)
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 30);

    // TODO: Calculate actual file size in background
    const file_size_mb = params.photo_ids.length * 2.5; // Rough estimate

    // Create download record
    const { data, error } = await supabase
      .from('selection_downloads')
      .insert({
        selection_id: params.selection_id,
        guest_id: params.guest_id,
        download_format: params.format,
        photo_count: params.photo_ids.length,
        file_size_mb,
        download_url: `https://wedhub.app/downloads/${download_key}`,
        download_key,
        expires_at: expires_at.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Queue background job to create ZIP file
    // TODO: Store photo_ids in separate table for retrieval

    return {
      id: data.id,
      selection_id: data.selection_id,
      photo_count: data.photo_count,
      format: data.download_format,
      download_url: data.download_url,
      expires_at: data.expires_at,
      file_size_mb: data.file_size_mb,
    };
  } catch (error) {
    console.error('Error generating download:', error);
    throw error;
  }
}

/**
 * D2. Get download history for selection
 */
export async function getDownloadHistory(selectionId: string): Promise<
  {
    id: string;
    guest_name: string;
    photo_count: number;
    format: string;
    downloaded_at: string;
    file_size_mb: number;
  }[]
> {
  try {
    const { data, error } = await supabase
      .from('selection_downloads')
      .select('id, guest_id, photo_count, download_format, created_at, file_size_mb')
      .eq('selection_id', selectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get guest names
    const downloads = await Promise.all(
      (data || []).map(async (dl) => {
        const { data: guest } = await supabase
          .from('photo_selection_guests')
          .select('name')
          .eq('id', dl.guest_id)
          .single();

        return {
          id: dl.id,
          guest_name: guest?.name || 'Unknown',
          photo_count: dl.photo_count,
          format: dl.download_format,
          downloaded_at: dl.created_at,
          file_size_mb: dl.file_size_mb,
        };
      }),
    );

    return downloads;
  } catch (error) {
    console.error('Error fetching download history:', error);
    throw error;
  }
}

// ============================================================================
// E. NOTIFICATION ENDPOINTS (2)
// ============================================================================

/**
 * E1. Send notification to guests
 */
export async function sendNotification(params: {
  selection_id: string;
  photographer_id: string;
  recipient_emails: string[];
  notification_type: 'invite' | 'reminder' | 'ready' | 'thank_you';
  custom_message?: string;
}): Promise<{ notifications_sent: number; failed: string[] }> {
  try {
    const failed: string[] = [];
    let sent = 0;

    for (const email of params.recipient_emails) {
      try {
        // Get recipient name if available
        const { data: guest } = await supabase
          .from('photo_selection_guests')
          .select('name')
          .eq('selection_id', params.selection_id)
          .eq('email', email)
          .single();

        const subject_lines = {
          invite: `You're invited to select photos!`,
          reminder: `Don't forget to select your favorite photos`,
          ready: `Your edited photos are ready!`,
          thank_you: `Thanks for helping select photos`,
        };

        // Insert notification record
        const { error } = await supabase
          .from('selection_notifications')
          .insert({
            selection_id: params.selection_id,
            photographer_id: params.photographer_id,
            recipient_email: email,
            recipient_name: guest?.name,
            notification_type: params.notification_type,
            subject_line: subject_lines[params.notification_type],
            status: 'pending',
          });

        if (error) {
          failed.push(email);
        } else {
          sent++;
          // TODO: Queue email sending via SendGrid
          // await queueEmail({
          //   to: email,
          //   subject: subject_lines[params.notification_type],
          //   template: `selection_${params.notification_type}`,
          //   data: { guest: guest?.name, custom_message: params.custom_message }
          // })
        }
      } catch (error) {
        console.error(`Error sending notification to ${email}:`, error);
        failed.push(email);
      }
    }

    return {
      notifications_sent: sent,
      failed,
    };
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
}

/**
 * E2. Get notification history
 */
export async function getNotificationHistory(selectionId: string): Promise<SelectionNotification[]> {
  try {
    const { data, error } = await supabase
      .from('selection_notifications')
      .select('*')
      .eq('selection_id', selectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notification history:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get selection by code (for public portal access)
 */
export async function getSelectionByCode(code: string): Promise<SelectionConfig | null> {
  try {
    const { data, error } = await supabase
      .from('photo_selections')
      .select('*')
      .eq('selection_code', code)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching selection by code:', error);
    return null;
  }
}

/**
 * Get or create guest session
 */
export async function getOrCreateGuestSession(params: {
  selection_id: string;
  guest_name: string;
  guest_email: string;
}): Promise<SelectionGuest> {
  try {
    // Check if guest exists
    const { data: existing } = await supabase
      .from('photo_selection_guests')
      .select('*')
      .eq('selection_id', params.selection_id)
      .eq('email', params.guest_email)
      .single();

    if (existing) {
      // Update last activity
      return updateGuestStatus(existing.id, existing.status);
    }

    // Create new guest
    return inviteGuest({
      selection_id: params.selection_id,
      guest_name: params.guest_name,
      guest_email: params.guest_email,
    });
  } catch (error) {
    console.error('Error getting guest session:', error);
    throw error;
  }
}

/**
 * Submit final selections
 */
export async function submitSelections(params: {
  selection_id: string;
  guest_id: string;
  final_selections: string[];
}): Promise<void> {
  try {
    // Verify selection count matches max_photos
    const { data: selection } = await supabase
      .from('photo_selections')
      .select('max_photos')
      .eq('id', params.selection_id)
      .single();

    if (selection && params.final_selections.length !== selection.max_photos) {
      throw new Error(`Must select exactly ${selection.max_photos} photos`);
    }

    // Mark guest as submitted
    await updateGuestStatus(params.guest_id, 'submitted');

    // TODO: Trigger "thank you" notification
  } catch (error) {
    console.error('Error submitting selections:', error);
    throw error;
  }
}
