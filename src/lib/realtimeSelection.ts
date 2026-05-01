/**
 * Real-time Selection Portal Service
 * Handles Supabase subscriptions for collaborative photo selection
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface GuestActivity {
  guest_id: string;
  guest_name: string;
  action: 'joined' | 'selected' | 'deselected' | 'submitted';
  photo_id?: string;
  timestamp: string;
}

export interface GuestPresence {
  guest_id: string;
  guest_name: string;
  selection_count: number;
  is_active: boolean;
  last_activity: string;
}

export class RealtimeSelectionService {
  private channel: RealtimeChannel | null = null;
  private selectionId: string = '';
  private guestId: string = '';

  /**
   * Subscribe to real-time selection updates
   */
  public subscribe(
    selectionId: string,
    guestId: string,
    callbacks: {
      onGuestActivity?: (activity: GuestActivity) => void;
      onSelectionUpdate?: (data: any) => void;
      onGuestJoined?: (guest: GuestPresence) => void;
      onGuestLeft?: (guestId: string) => void;
      onError?: (error: Error) => void;
    }
  ) {
    this.selectionId = selectionId;
    this.guestId = guestId;

    // Create a unique channel for this selection
    const channelName = `selection:${selectionId}`;
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    // Listen for real-time selection changes (when guests select/deselect photos)
    this.channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selection_guest_selections',
          filter: `selection_id=eq.${selectionId}`,
        },
        (payload) => {
          console.log('[Realtime] Selection update:', payload);
          const action =
            payload.eventType === 'INSERT'
              ? 'selected'
              : payload.eventType === 'DELETE'
                ? 'deselected'
                : 'modified';

          const activity: GuestActivity = {
            guest_id: (payload.new as any)?.guest_id || (payload.old as any)?.guest_id || '',
            guest_name: (payload.new as any)?.guest_name || '', // Fetch separately if needed
            action: action as any,
            photo_id: (payload.new as any)?.photo_id || (payload.old as any)?.photo_id,
            timestamp: new Date().toISOString(),
          };

          callbacks.onSelectionUpdate?.(payload);
          if (activity.guest_id !== guestId) {
            // Only notify about other guests' activities
            callbacks.onGuestActivity?.(activity);
          }
        }
      )
      // Listen for guest status updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_selection_guests',
          filter: `selection_id=eq.${selectionId}`,
        },
        (payload) => {
          console.log('[Realtime] Guest status update:', payload);
          const guest = payload.new as any;
          if (guest.id !== guestId && guest.status === 'accepted') {
            callbacks.onGuestJoined?.({
              guest_id: guest.id,
              guest_name: guest.name,
              selection_count: guest.selection_count || 0,
              is_active: guest.status === 'accepted',
              last_activity: guest.last_activity || new Date().toISOString(),
            });
          }
        }
      )
      // Listen for selection portal config changes (deadline, status)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_selections',
          filter: `id=eq.${selectionId}`,
        },
        (payload) => {
          console.log('[Realtime] Selection config update:', payload);
          if (payload.new?.status !== payload.old?.status) {
            // Status changed (e.g., portal closed)
            callbacks.onSelectionUpdate?.(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to selection updates');
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error('Failed to subscribe to real-time updates');
          callbacks.onError?.(error);
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Subscription closed');
        }
      });
  }

  /**
   * Broadcast that current guest selected a photo (for other guests)
   */
  public broadcastSelection(photoId: string, guestName: string) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'guest_selected',
      payload: {
        guest_id: this.guestId,
        guest_name: guestName,
        photo_id: photoId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Broadcast that current guest is active
   */
  public broadcastActivity(action: string) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'guest_activity',
      payload: {
        guest_id: this.guestId,
        action,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Unsubscribe from real-time updates
   */
  public unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('[Realtime] Unsubscribed from selection updates');
    }
  }

  /**
   * Get active guests for a selection (from presence tracking)
   */
  public static async getActiveGuests(selectionId: string) {
    try {
      const { data, error } = await supabase
        .from('photo_selection_guests')
        .select('id, name, status, last_activity')
        .eq('selection_id', selectionId)
        .eq('status', 'accepted')
        .order('last_activity', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Realtime] Error fetching active guests:', error);
      return [];
    }
  }

  /**
   * Track guest activity (last seen, active status)
   */
  public static async updateGuestActivity(guestId: string, selectionId: string) {
    try {
      const { error } = await supabase
        .from('photo_selection_guests')
        .update({
          last_activity: new Date().toISOString(),
          status: 'accepted',
        })
        .eq('id', guestId)
        .eq('selection_id', selectionId);

      if (error) throw error;
    } catch (error) {
      console.error('[Realtime] Error updating guest activity:', error);
    }
  }
}

// Singleton instance
let realtimeService: RealtimeSelectionService | null = null;

export function getRealtimeSelectionService() {
  if (!realtimeService) {
    realtimeService = new RealtimeSelectionService();
  }
  return realtimeService;
}

