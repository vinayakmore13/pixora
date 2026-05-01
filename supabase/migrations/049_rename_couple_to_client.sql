BEGIN;

-- Migration 049: Rename couple references to client
-- Updates all database references from couple_id/couple_name to client_id/client_name

-- 1. Backfill client_name if not already set
UPDATE public.events 
SET client_name = name
WHERE client_name IS NULL;

-- 2. Create indexes for client columns (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_events_client_id ON events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_client_name ON events(client_name);

-- 3. Create a backward compatibility view for legacy queries
-- We drop it first to avoid "cannot change name of view column" errors
DROP VIEW IF EXISTS public.events_with_couple_refs CASCADE;

-- 4. Handle Policy Dependencies
-- We need to drop policies that use couple_id before we can drop the column
DROP POLICY IF EXISTS "Photographers can create events" ON public.events;
DROP POLICY IF EXISTS "Clients can view assigned events" ON public.events;
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

-- 5. Final Cleanup: Remove legacy columns from the main table
ALTER TABLE public.events DROP COLUMN IF EXISTS couple_id;
ALTER TABLE public.events DROP COLUMN IF EXISTS couple_name;

-- 6. Recreate the view safely (now that columns are gone, it will use aliases)
DO $$ 
DECLARE
    cols TEXT;
BEGIN
    cols := 'id, user_id, name, description, event_date, location, cover_image_url, guest_qr_code, upload_password_hash, max_photos, allow_guest_uploads, moderate_guest_photos, ai_enabled, status, created_at, updated_at, owner_type, owner_id, client_id, client_name, client_id AS couple_id, client_name AS couple_name';
    EXECUTE 'CREATE VIEW events_with_couple_refs AS SELECT ' || cols || ' FROM public.events';
END $$;

COMMENT ON VIEW events_with_couple_refs IS 'Legacy view for backward compatibility - use events table directly';

-- 7. Recreate Policies using client_id
CREATE POLICY "Photographers can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = photographer_id OR auth.uid() = client_id);

CREATE POLICY "Clients can view own events" ON public.events
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Clients can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = client_id);

CREATE POLICY "Clients can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = client_id);

-- 8. Grant access
GRANT SELECT ON public.events_with_couple_refs TO authenticated;
GRANT SELECT ON public.events_with_couple_refs TO anon;

COMMIT;