import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BrandingData } from '../lib/watermarkUtils';

const BRANDING_COLUMNS = `
  studio_name, logo_url, brand_color_primary, brand_color_secondary,
  watermark_type, watermark_position, watermark_opacity, watermark_size,
  contact_phone, contact_email, website_url, instagram_handle, facebook_url,
  tagline, services_offered, bio, location, rating, reviews_count
`;

export interface PhotographerBranding extends BrandingData {
  bio: string | null;
  location: string | null;
  rating: number;
  reviews_count: number;
}

const DEFAULTS: PhotographerBranding = {
  studio_name: null,
  logo_url: null,
  brand_color_primary: '#FF6B6B',
  brand_color_secondary: '#1A1F3A',
  watermark_type: 'text',
  watermark_position: 'bottom_right',
  watermark_opacity: 30,
  watermark_size: 'medium',
  contact_phone: null,
  contact_email: null,
  website_url: null,
  instagram_handle: null,
  facebook_url: null,
  tagline: null,
  services_offered: [],
  bio: null,
  location: null,
  rating: 0,
  reviews_count: 0,
};

/**
 * Fetch photographer branding data by photographer user ID.
 */
export function usePhotographerBranding(photographerId: string | null | undefined) {
  const [branding, setBranding] = useState<PhotographerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photographerId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchBranding() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('photographer_profiles')
          .select(BRANDING_COLUMNS)
          .eq('id', photographerId)
          .single();

        if (cancelled) return;

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (data) {
          setBranding({ ...DEFAULTS, ...data });
        } else {
          setBranding(DEFAULTS);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[usePhotographerBranding] Error:', err);
          setError(err.message || 'Failed to load branding data');
          setBranding(DEFAULTS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBranding();
    return () => { cancelled = true; };
  }, [photographerId]);

  return { branding, loading, error };
}

/**
 * Fetch photographer branding by event ID (looks up event → user_id → branding).
 */
export function useEventBranding(eventId: string | null | undefined) {
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setEventLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchEventOwner() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('user_id, show_photographer_branding')
          .eq('id', eventId)
          .single();

        if (cancelled) return;

        if (!error && data?.show_photographer_branding) {
          setPhotographerId(data.user_id);
        }
      } catch (err) {
        console.error('[useEventBranding] Error:', err);
      } finally {
        if (!cancelled) setEventLoading(false);
      }
    }

    fetchEventOwner();
    return () => { cancelled = true; };
  }, [eventId]);

  const brandingResult = usePhotographerBranding(photographerId);

  return {
    ...brandingResult,
    loading: eventLoading || brandingResult.loading,
    photographerId,
  };
}
