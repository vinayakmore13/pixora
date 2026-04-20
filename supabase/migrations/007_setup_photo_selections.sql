-- Add is_edited column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_photos_is_edited ON photos(is_edited);

-- Create photo_selections table
CREATE TABLE IF NOT EXISTS photo_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    selection_code TEXT UNIQUE NOT NULL,
    max_photos INTEGER NOT NULL DEFAULT 50,
    deadline TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photo_selections_event_id ON photo_selections(event_id);
CREATE INDEX IF NOT EXISTS idx_photo_selections_code ON photo_selections(selection_code);

-- Create photo_selection_guests table
CREATE TABLE IF NOT EXISTS photo_selection_guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(selection_id, name)
);
CREATE INDEX IF NOT EXISTS idx_photo_selection_guests_selection_id ON photo_selection_guests(selection_id);

-- Create photo_favorites table
CREATE TABLE IF NOT EXISTS photo_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(selection_id, photo_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_favorites_selection_id ON photo_favorites(selection_id);
CREATE INDEX IF NOT EXISTS idx_photo_favorites_photo_id ON photo_favorites(photo_id);

-- Enable RLS
ALTER TABLE photo_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_selection_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_favorites ENABLE ROW LEVEL SECURITY;

-- Policies for photo_selections
-- Event owner can do everything
CREATE POLICY "Event owners can manage selections"
    ON photo_selections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = photo_selections.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Public can view selections by code
CREATE POLICY "Public can view selections by code"
    ON photo_selections FOR SELECT
    USING (true);

-- Public can update selections (to submit)
CREATE POLICY "Public can update selections"
    ON photo_selections FOR UPDATE
    USING (true);

-- Policies for photo_selection_guests
-- Event owner can view guests
CREATE POLICY "Event owners can view selection guests"
    ON photo_selection_guests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            JOIN photo_selections ON events.id = photo_selections.event_id
            WHERE photo_selections.id = photo_selection_guests.selection_id
            AND events.user_id = auth.uid()
        )
    );

-- Public can generate a guest session if they have the selection code
CREATE POLICY "Public can view/insert guests for selection"
    ON photo_selection_guests FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for photo_favorites
-- Event owner can view favorites
CREATE POLICY "Event owners can view favorites"
    ON photo_favorites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            JOIN photo_selections ON events.id = photo_selections.event_id
            WHERE photo_selections.id = photo_favorites.selection_id
            AND events.user_id = auth.uid()
        )
    );

-- Public can act on favorites (view, insert, delete)
CREATE POLICY "Public can manage favorites"
    ON photo_favorites FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger for photo_selections
CREATE TRIGGER update_photo_selections_updated_at
    BEFORE UPDATE ON photo_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
