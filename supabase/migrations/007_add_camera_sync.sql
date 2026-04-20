-- Add camera sync settings to events table
-- This migration adds support for WiFi camera auto-sync feature

-- Add camera_sync_config column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS camera_sync_config JSONB DEFAULT NULL;

-- Add camera_sync_enabled column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS camera_sync_enabled BOOLEAN DEFAULT FALSE;

-- Add camera_sync_stats column to events table for tracking sync statistics
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS camera_sync_stats JSONB DEFAULT NULL;

-- Add last_camera_sync_at column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS last_camera_sync_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for camera_sync_enabled for faster queries
CREATE INDEX IF NOT EXISTS idx_events_camera_sync_enabled 
ON events(camera_sync_enabled) 
WHERE camera_sync_enabled = TRUE;

-- Create index for last_camera_sync_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_events_last_camera_sync_at 
ON events(last_camera_sync_at) 
WHERE last_camera_sync_at IS NOT NULL;

-- Add comment to explain the camera_sync_config structure
COMMENT ON COLUMN events.camera_sync_config IS 'JSON configuration for camera sync. Structure: { type: "canon"|"sony"|"nikon"|"phone", ipAddress: string, port: number, apiKey?: string, autoConnect?: boolean }';

-- Add comment to explain camera_sync_stats structure
COMMENT ON COLUMN events.camera_sync_stats IS 'JSON statistics for camera sync. Structure: { totalSynced: number, totalFailed: number, lastSyncTime: string, isRunning: boolean, currentCamera: string }';

-- Create a function to update camera sync stats
CREATE OR REPLACE FUNCTION update_camera_sync_stats(
  event_id UUID,
  stats JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET 
    camera_sync_stats = stats,
    last_camera_sync_at = NOW(),
    updated_at = NOW()
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get events with active camera sync
CREATE OR REPLACE FUNCTION get_events_with_active_camera_sync()
RETURNS TABLE (
  id UUID,
  title TEXT,
  camera_sync_config JSONB,
  camera_sync_stats JSONB,
  last_camera_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.camera_sync_config,
    e.camera_sync_stats,
    e.last_camera_sync_at
  FROM events e
  WHERE e.camera_sync_enabled = TRUE
  ORDER BY e.last_camera_sync_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Create a function to disable camera sync for an event
CREATE OR REPLACE FUNCTION disable_camera_sync(event_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET 
    camera_sync_enabled = FALSE,
    camera_sync_stats = NULL,
    updated_at = NOW()
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to enable camera sync for an event
CREATE OR REPLACE FUNCTION enable_camera_sync(
  event_id UUID,
  config JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET 
    camera_sync_enabled = TRUE,
    camera_sync_config = config,
    camera_sync_stats = jsonb_build_object(
      'totalSynced', 0,
      'totalFailed', 0,
      'lastSyncTime', NULL,
      'isRunning', FALSE,
      'currentCamera', config->>'type'
    ),
    updated_at = NOW()
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_camera_sync_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_with_active_camera_sync TO authenticated;
GRANT EXECUTE ON FUNCTION disable_camera_sync TO authenticated;
GRANT EXECUTE ON FUNCTION enable_camera_sync TO authenticated;

-- Add RLS policies for camera sync settings
-- Users can only update camera sync settings for their own events
CREATE POLICY "Users can update camera sync settings for their own events"
ON events
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view camera sync settings for their own events
CREATE POLICY "Users can view camera sync settings for their own events"
ON events
FOR SELECT
USING (auth.uid() = user_id);

-- Create a view for camera sync dashboard
CREATE OR REPLACE VIEW camera_sync_dashboard AS
SELECT 
  e.id AS event_id,
  e.title AS event_title,
  e.camera_sync_enabled,
  e.camera_sync_config,
  e.camera_sync_stats,
  e.last_camera_sync_at,
  p.id AS photographer_id,
  p.full_name AS photographer_name,
  p.email AS photographer_email,
  COUNT(ph.id) AS total_photos_uploaded,
  COUNT(CASE WHEN ph.uploaded_at > NOW() - INTERVAL '1 hour' THEN 1 END) AS photos_last_hour,
  COUNT(CASE WHEN ph.uploaded_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS photos_last_24h
FROM events e
LEFT JOIN profiles p ON e.user_id = p.id
LEFT JOIN photos ph ON e.id = ph.event_id
WHERE e.camera_sync_enabled = TRUE
GROUP BY e.id, e.title, e.camera_sync_enabled, e.camera_sync_config, 
         e.camera_sync_stats, e.last_camera_sync_at, p.id, p.full_name, p.email;

-- Grant access to the view
GRANT SELECT ON camera_sync_dashboard TO authenticated;

-- Add comment to the view
COMMENT ON VIEW camera_sync_dashboard IS 'Dashboard view for monitoring camera sync status across events';

-- Insert sample camera sync configurations for testing
-- Note: These are examples and should be removed in production
/*
INSERT INTO events (id, user_id, title, camera_sync_enabled, camera_sync_config)
VALUES 
  (
    gen_random_uuid(),
    (SELECT id FROM profiles LIMIT 1),
    'Wedding - Smith & Johnson',
    TRUE,
    '{"type": "canon", "ipAddress": "192.168.1.1", "port": 8080, "autoConnect": true}'::jsonb
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM profiles LIMIT 1),
    'Corporate Event - Tech Corp',
    TRUE,
    '{"type": "sony", "ipAddress": "192.168.1.2", "port": 8080, "autoConnect": true}'::jsonb
  );
*/
