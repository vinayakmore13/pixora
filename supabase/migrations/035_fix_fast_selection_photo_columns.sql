-- Fix fast_selection_photos schema to match uploadManager expectations
ALTER TABLE fast_selection_photos 
ADD COLUMN IF NOT EXISTS uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS upload_session_id TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fast_selection_photos_uploader ON fast_selection_photos(uploader_id);
CREATE INDEX IF NOT EXISTS idx_fast_selection_photos_session_token ON fast_selection_photos(upload_session_id);
