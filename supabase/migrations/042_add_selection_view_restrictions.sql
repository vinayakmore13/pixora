-- Add view restrictions and secure mode to photo_selections
ALTER TABLE photo_selections 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_views INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS is_secure_mode BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add tracking for specific guest views
CREATE TABLE IF NOT EXISTS selection_view_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    selection_id UUID REFERENCES photo_selections(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES photo_selection_guests(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to safely increment view count and log it
CREATE OR REPLACE FUNCTION increment_selection_view(
    p_selection_id UUID,
    p_guest_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_views INTEGER;
    v_max_views INTEGER;
    v_is_secure BOOLEAN;
BEGIN
    -- Get current status
    SELECT view_count, max_views, is_secure_mode
    INTO v_current_views, v_max_views, v_is_secure
    FROM photo_selections
    WHERE id = p_selection_id;

    -- If not found, return error
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Selection not found');
    END IF;

    -- Increment and log
    UPDATE photo_selections
    SET view_count = view_count + 1
    WHERE id = p_selection_id;

    INSERT INTO selection_view_logs (selection_id, guest_id, ip_address, user_agent)
    VALUES (p_selection_id, p_guest_id, p_ip_address, p_user_agent);

    RETURN jsonb_build_object(
        'success', true,
        'view_count', v_current_views + 1,
        'max_views', v_max_views,
        'is_secure', v_is_secure
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for the new table
ALTER TABLE selection_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can view their selection logs"
    ON selection_view_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            JOIN photo_selections ON events.id = photo_selections.event_id
            WHERE photo_selections.id = selection_view_logs.selection_id
            AND events.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can insert view logs"
    ON selection_view_logs FOR INSERT
    WITH CHECK (true);
