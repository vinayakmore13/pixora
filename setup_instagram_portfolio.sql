-- =========================================================================
-- INSTAGRAM PORTFOLIO SETUP SCRIPT
-- Please run this exact script in your Supabase Dashboard SQL Editor
-- This will fix the upload errors and enable the Instagram-style features!
-- =========================================================================

-- 1. Add required columns for Instagram-style portfolio
ALTER TABLE public.portfolio_images 
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hash VARCHAR(64);

-- 2. Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photos',
    'photos',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Set up Storage Policies so photographers can upload photos
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public can view photos" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'photos');

CREATE POLICY "Event owners can delete photos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update photos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
