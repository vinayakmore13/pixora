-- Migration 020: Storage Setup for Event Covers
-- Provisions the 'event-covers' bucket and sets up RLS policies

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'event-covers', 'event-covers', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'event-covers'
);

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public read access for all objects in event-covers
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-covers');

-- 4. Policy: Authenticated users can upload their own event covers
-- Folder structure: event-covers/{user_id}/{filename}
DROP POLICY IF EXISTS "Users can upload their own event covers" ON storage.objects;
CREATE POLICY "Users can upload their own event covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'event-covers' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Policy: Authenticated users can update/delete their own event covers
DROP POLICY IF EXISTS "Users can update their own event covers" ON storage.objects;
CREATE POLICY "Users can update their own event covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'event-covers' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own event covers" ON storage.objects;
CREATE POLICY "Users can delete their own event covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'event-covers' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
