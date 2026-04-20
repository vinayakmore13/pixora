-- Create upload_sessions table for managing upload sessions
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT true
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_upload_sessions_event_id ON upload_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_token ON upload_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON upload_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Event owners can view upload sessions for their events
CREATE POLICY "Event owners can view upload sessions"
    ON upload_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = upload_sessions.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Public can view upload sessions by token (for guest uploads)
CREATE POLICY "Public can view upload sessions by token"
    ON upload_sessions FOR SELECT
    USING (true);

-- Create photos table for storing photo metadata
CREATE TABLE IF NOT EXISTS photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    upload_session_id UUID REFERENCES upload_sessions(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    thumbnail_url TEXT,
    is_approved BOOLEAN DEFAULT true,
    is_guest_upload BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploader_id ON photos(uploader_id);
CREATE INDEX IF NOT EXISTS idx_photos_upload_session_id ON photos(upload_session_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Policy: Event owners can view all photos for their events
CREATE POLICY "Event owners can view all photos"
    ON photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = photos.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Event owners can update photos for their events
CREATE POLICY "Event owners can update photos"
    ON photos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = photos.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Event owners can delete photos for their events
CREATE POLICY "Event owners can delete photos"
    ON photos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = photos.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Authenticated users can insert photos
CREATE POLICY "Authenticated users can insert photos"
    ON photos FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Public can view photos by event (for guest access)
CREATE POLICY "Public can view photos by event"
    ON photos FOR SELECT
    USING (true);

-- Create function to clean up expired upload sessions
CREATE OR REPLACE FUNCTION cleanup_expired_upload_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM upload_sessions
    WHERE expires_at < NOW() OR is_valid = false;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate upload session
CREATE OR REPLACE FUNCTION validate_upload_session(session_token TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    event_id UUID,
    session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (upload_sessions.is_valid AND upload_sessions.expires_at > NOW()) AS is_valid,
        upload_sessions.event_id,
        upload_sessions.id AS session_id
    FROM upload_sessions
    WHERE upload_sessions.session_token = session_token;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment photo count on events
CREATE OR REPLACE FUNCTION increment_event_photo_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE events
    SET max_photos = max_photos - 1
    WHERE id = NEW.event_id AND max_photos > 0;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to decrement photo count when photo is inserted
CREATE TRIGGER decrement_event_photo_count
    AFTER INSERT ON photos
    FOR EACH ROW
    EXECUTE FUNCTION increment_event_photo_count();
