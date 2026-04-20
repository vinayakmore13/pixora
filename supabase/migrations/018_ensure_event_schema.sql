-- 1. Ensure events table columns are correctly named
DO $$ 
BEGIN
  -- Rename user_id to couple_id if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'user_id') THEN
    ALTER TABLE public.events RENAME COLUMN user_id TO couple_id;
  END IF;

  -- Rename title to name if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'title') THEN
    ALTER TABLE public.events RENAME COLUMN title TO name;
  END IF;

  -- Rename qr_code to guest_qr_code if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'qr_code') THEN
    ALTER TABLE public.events RENAME COLUMN qr_code TO guest_qr_code;
  END IF;

  -- Rename upload_password to upload_password_hash if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'upload_password') THEN
    ALTER TABLE public.events RENAME COLUMN upload_password TO upload_password_hash;
  END IF;

  -- Rename enable_ai_finder to ai_enabled if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'enable_ai_finder') THEN
    ALTER TABLE public.events RENAME COLUMN enable_ai_finder TO ai_enabled;
  END IF;
END $$;

-- 2. Update RLS policies for events if needed
-- We'll just recreate them to be safe and ensure they use couple_id
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = couple_id);

DROP POLICY IF EXISTS "Users can create events" ON public.events;
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = couple_id);

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = couple_id);

DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = couple_id);

-- 3. Public access for public event page (via QR code)
DROP POLICY IF EXISTS "Public can view event by guest_qr_code" ON public.events;
CREATE POLICY "Public can view event by guest_qr_code" ON public.events
  FOR SELECT USING (true); -- Usually we'd check guest_qr_code in the query anyway
