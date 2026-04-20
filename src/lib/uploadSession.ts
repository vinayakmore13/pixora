import { supabase } from './supabaseClient';

export interface UploadSession {
  id: string;
  event_id: string;
  session_token: string;
  expires_at: string;
  is_valid: boolean;
}

export interface UploadSessionValidation {
  is_valid: boolean;
  event_id: string;
  session_id: string;
}

/**
 * Verify upload password and create a new upload session
 */
export async function verifyUploadPassword(
  eventId: string,
  password: string
): Promise<{ success: boolean; sessionToken?: string; expiresAt?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-upload-password', {
      body: { event_id: eventId, password },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      sessionToken: data.session_token,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Validate an existing upload session
 */
export async function validateUploadSession(
  sessionToken: string
): Promise<UploadSessionValidation | null> {
  try {
    const { data, error } = await supabase
      .rpc('validate_upload_session', { session_token: sessionToken });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0];
  } catch (error) {
    console.error('Error validating upload session:', error);
    return null;
  }
}

/**
 * Get upload session by token
 */
export async function getUploadSessionByToken(
  sessionToken: string
): Promise<UploadSession | null> {
  try {
    const { data, error } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting upload session:', error);
    return null;
  }
}

/**
 * Invalidate an upload session
 */
export async function invalidateUploadSession(sessionToken: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('upload_sessions')
      .update({ is_valid: false })
      .eq('session_token', sessionToken);

    return !error;
  } catch (error) {
    console.error('Error invalidating upload session:', error);
    return false;
  }
}

/**
 * Clean up expired upload sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await supabase.rpc('cleanup_expired_upload_sessions');
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Store session token in localStorage
 */
export function storeSessionToken(eventId: string, sessionToken: string, expiresAt: string): void {
  const sessionData = {
    session_token: sessionToken,
    expires_at: expiresAt,
    event_id: eventId,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(`upload_session_${eventId}`, JSON.stringify(sessionData));
}

/**
 * Get session token from localStorage
 */
export function getStoredSessionToken(eventId: string): {
  session_token: string;
  expires_at: string;
  event_id: string;
} | null {
  try {
    const data = localStorage.getItem(`upload_session_${eventId}`);
    if (!data) return null;

    const session = JSON.parse(data);
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      localStorage.removeItem(`upload_session_${eventId}`);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Remove session token from localStorage
 */
export function removeStoredSessionToken(eventId: string): void {
  localStorage.removeItem(`upload_session_${eventId}`);
}
