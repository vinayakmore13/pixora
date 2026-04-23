-- Fast Selection V2 Schema

-- 1. Selection Sessions (Standalone)
CREATE TABLE IF NOT EXISTS fast_selection_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    photographer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    selection_code TEXT UNIQUE NOT NULL,
    max_photos INTEGER DEFAULT 50,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fast_selection_sessions_photographer ON fast_selection_sessions(photographer_id);
CREATE INDEX IF NOT EXISTS idx_fast_selection_sessions_code ON fast_selection_sessions(selection_code);

-- 2. Photos for the session
CREATE TABLE IF NOT EXISTS fast_selection_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES fast_selection_sessions(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    upload_session_id TEXT,
    file_name TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fast_selection_photos_session ON fast_selection_photos(session_id);
CREATE INDEX IF NOT EXISTS idx_fast_selection_photos_uploader ON fast_selection_photos(uploader_id);

-- 3. Clients/Guests for the session
CREATE TABLE IF NOT EXISTS fast_selection_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES fast_selection_sessions(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    is_verified BOOLEAN DEFAULT false,
    otp_code TEXT,
    ai_unlocked_limit INTEGER DEFAULT 1, -- Default 1 free photo
    status TEXT DEFAULT 'accepted' CHECK (status IN ('invited', 'accepted', 'submitted', 'completed')),
    session_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, email)
);

-- 4. Favorites (Selections)
CREATE TABLE IF NOT EXISTS fast_selection_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES fast_selection_clients(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES fast_selection_photos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, photo_id)
);

-- Enable RLS
ALTER TABLE fast_selection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_selection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_selection_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_selection_favorites ENABLE ROW LEVEL SECURITY;

-- Basic Public Policies (To be refined with verification logic)
DROP POLICY IF EXISTS "Public read sessions" ON fast_selection_sessions;
CREATE POLICY "Public read sessions" ON fast_selection_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read session photos" ON fast_selection_photos;
CREATE POLICY "Public read session photos" ON fast_selection_photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public manage clients" ON fast_selection_clients;
CREATE POLICY "Public manage clients" ON fast_selection_clients FOR ALL USING (true);

DROP POLICY IF EXISTS "Public manage favorites" ON fast_selection_favorites;
CREATE POLICY "Public manage favorites" ON fast_selection_favorites FOR ALL USING (true);

-- Photographer Policies
DROP POLICY IF EXISTS "Photographers manage their sessions" ON fast_selection_sessions;
CREATE POLICY "Photographers manage their sessions" ON fast_selection_sessions FOR ALL 
USING (photographer_id = auth.uid());

DROP POLICY IF EXISTS "Photographers manage photos of their sessions" ON fast_selection_photos;
CREATE POLICY "Photographers manage photos of their sessions" ON fast_selection_photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM fast_selection_sessions
    WHERE fast_selection_sessions.id = fast_selection_photos.session_id
    AND fast_selection_sessions.photographer_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM fast_selection_sessions
    WHERE fast_selection_sessions.id = session_id
    AND fast_selection_sessions.photographer_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_fast_selection_sessions_updated_at ON fast_selection_sessions;
CREATE TRIGGER update_fast_selection_sessions_updated_at
    BEFORE UPDATE ON fast_selection_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
