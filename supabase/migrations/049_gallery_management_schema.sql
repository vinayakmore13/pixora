-- Add gallery management fields to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_password_protected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gallery_password_hash TEXT,
ADD COLUMN IF NOT EXISTS guest_access_enabled BOOLEAN DEFAULT true;

-- Add branding and watermark fields to photographer_profiles
ALTER TABLE public.photographer_profiles
ADD COLUMN IF NOT EXISTS studio_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color_primary TEXT,
ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT,
ADD COLUMN IF NOT EXISTS font_preference TEXT,
ADD COLUMN IF NOT EXISTS watermark_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'bottom_right',
ADD COLUMN IF NOT EXISTS watermark_opacity INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS watermark_size TEXT DEFAULT 'medium';
