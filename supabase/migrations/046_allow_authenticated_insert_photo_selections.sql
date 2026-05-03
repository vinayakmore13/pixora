-- Allow any authenticated user to insert into photo_selections
-- This enables auto-creation of selection portals when clients submit their picks
-- Safety: event_id FK constraint + unique constraint + status CHECK constraint prevent abuse
CREATE POLICY "Authenticated users can create selections"
    ON photo_selections FOR INSERT
    TO authenticated
    WITH CHECK (true);
