-- 1. Create the bucket for event cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies
-- Allow anyone to view cover images
DROP POLICY IF EXISTS "Cover images are publicly accessible" ON storage.objects;
CREATE POLICY "Cover images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-covers');

-- Allow authenticated users to upload their own cover images
DROP POLICY IF EXISTS "Users can upload their own cover images" ON storage.objects;
CREATE POLICY "Users can upload their own cover images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-covers' AND 
    auth.role() = 'authenticated'
  );

-- Allow users to update/delete their own cover images
DROP POLICY IF EXISTS "Users can update their own cover images" ON storage.objects;
CREATE POLICY "Users can update their own cover images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-covers' AND 
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can delete their own cover images" ON storage.objects;
CREATE POLICY "Users can delete their own cover images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'event-covers' AND 
    auth.role() = 'authenticated'
  );
