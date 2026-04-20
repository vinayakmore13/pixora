-- Add camera sync settings to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS camera_sync_config JSONB DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS camera_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS camera_sync_stats JSONB DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_camera_sync_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_events_camera_sync_enabled ON events(camera_sync_enabled) WHERE camera_sync_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_last_camera_sync_at ON events(last_camera_sync_at) WHERE last_camera_sync_at IS NOT NULL;

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

CREATE OR REPLACE FUNCTION get_events_with_active_camera_sync()
RETURNS TABLE (
  id UUID,
  name TEXT,
  camera_sync_config JSONB,
  camera_sync_stats JSONB,
  last_camera_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.camera_sync_config,
    e.camera_sync_stats,
    e.last_camera_sync_at
  FROM events e
  WHERE e.camera_sync_enabled = TRUE
  ORDER BY e.last_camera_sync_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE VIEW camera_sync_dashboard AS
SELECT 
  e.id AS event_id,
  e.name AS event_title,
  e.camera_sync_enabled,
  e.camera_sync_config,
  e.camera_sync_stats,
  e.last_camera_sync_at,
  p.id AS photographer_id,
  p.full_name AS photographer_name,
  p.email AS photographer_email,
  COUNT(ph.id) AS total_photos_uploaded,
  COUNT(CASE WHEN ph.created_at > NOW() - INTERVAL '1 hour' THEN 1 END) AS photos_last_hour,
  COUNT(CASE WHEN ph.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS photos_last_24h
FROM events e LEFT JOIN profiles p ON e.creator_id = p.id
LEFT JOIN photos ph ON e.id = ph.event_id
WHERE e.camera_sync_enabled = TRUE
GROUP BY e.id, e.name, e.camera_sync_enabled, e.camera_sync_config, 
         e.camera_sync_stats, e.last_camera_sync_at, p.id, p.full_name, p.email;

GRANT SELECT ON camera_sync_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION update_camera_sync_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_with_active_camera_sync TO authenticated;
GRANT EXECUTE ON FUNCTION disable_camera_sync TO authenticated;
GRANT EXECUTE ON FUNCTION enable_camera_sync TO authenticated;
