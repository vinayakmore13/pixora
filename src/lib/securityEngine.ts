import { supabase } from './supabaseClient';

/**
 * Generates a unique device fingerprint without requiring intrusive permissions.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const data = {
    ua: navigator.userAgent,
    res: `${window.screen.width}x${window.screen.height}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    mem: (navigator as any).deviceMemory || 'unknown',
    cores: navigator.hardwareConcurrency || 'unknown',
    plt: navigator.platform,
  };
  
  const msgUint8 = new TextEncoder().encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Logs security events directly to Supabase.
 */
export async function logSecurityEvent(sessionId: string, eventType: string, details: any = {}) {
  try {
    await supabase.from('security_events').insert({
      session_id: sessionId,
      event_type: eventType,
      event_details: {
        ...details,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      },
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
}

/**
 * Steganography helper: Injects a hidden ID into the alpha channel of an image.
 * This is nearly invisible but can be used to trace leaks.
 */
export function injectInvisibleWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, payload: string) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const binaryPayload = payload.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');

  for (let i = 0; i < binaryPayload.length && i * 4 < data.length; i++) {
    const bit = parseInt(binaryPayload[i], 10);
    // Use the last bit of the Blue channel for minimal visual impact
    data[i * 4 + 2] = (data[i * 4 + 2] & 0xFE) | bit;
  }

  ctx.putImageData(imageData, 0, 0);
}

