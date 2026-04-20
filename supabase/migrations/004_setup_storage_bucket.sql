-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photos',
    'photos',
    true,
    209715200, -- 200MB limit for high-resolution camera photos
    ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for storage.objects must be configured through Supabase Dashboard
-- Go to Storage > Policies and add the following policies:
--
-- 1. Policy Name: "Authenticated users can upload photos"
--    Allowed operation: INSERT
--    Target roles: authenticated
--    USING expression: bucket_id = 'photos'
--    WITH CHECK expression: bucket_id = 'photos' AND auth.uid() IS NOT NULL
--
-- 2. Policy Name: "Public can view photos"
--    Allowed operation: SELECT
--    Target roles: public
--    USING expression: bucket_id = 'photos'
--
-- 3. Policy Name: "Event owners can delete photos"
--    Allowed operation: DELETE
--    Target roles: authenticated
--    USING expression: bucket_id = 'photos'
--
-- 4. Policy Name: "Authenticated users can update photos"
--    Allowed operation: UPDATE
--    Target roles: authenticated
--    USING expression: bucket_id = 'photos' AND auth.uid() IS NOT NULL
