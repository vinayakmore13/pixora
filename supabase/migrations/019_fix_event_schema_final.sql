-- Migration 019: Fix Event Schema Final
-- Ensures all columns required by the updated CreateEvent.tsx exist

DO $$ 
BEGIN
  -- 1. Ensure allow_guest_uploads exists (Default true)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'allow_guest_uploads') THEN
    ALTER TABLE public.events ADD COLUMN allow_guest_uploads BOOLEAN DEFAULT true;
  END IF;

  -- 2. Ensure moderate_guest_photos exists (Default false)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'moderate_guest_photos') THEN
    ALTER TABLE public.events ADD COLUMN moderate_guest_photos BOOLEAN DEFAULT false;
  END IF;

  -- 3. Ensure max_photos exists (Default 5000)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'max_photos') THEN
    ALTER TABLE public.events ADD COLUMN max_photos INTEGER DEFAULT 5000;
  END IF;

  -- 4. Ensure description exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'description') THEN
    ALTER TABLE public.events ADD COLUMN description TEXT;
  END IF;

  -- 5. Ensure location exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'location') THEN
    ALTER TABLE public.events ADD COLUMN location TEXT;
  END IF;

  -- 6. Ensure cover_image_url exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cover_image_url') THEN
    ALTER TABLE public.events ADD COLUMN cover_image_url TEXT;
  END IF;

  -- 7. Ensure event_date exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'event_date') THEN
    ALTER TABLE public.events ADD COLUMN event_date TIMESTAMP WITH TIME ZONE;
  END IF;

END $$;

-- Refresh PostgREST cache (optional but helpful if running in one block)
-- NOTIFY pgrst, 'reload schema';
