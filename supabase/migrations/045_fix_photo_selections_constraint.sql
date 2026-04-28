-- Fix photo_selections unique constraint for event_id
-- This is required for the .upsert({ onConflict: 'event_id' }) call in ClientSelections.tsx

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'photo_selections_event_id_key'
    ) THEN
        ALTER TABLE public.photo_selections ADD CONSTRAINT photo_selections_event_id_key UNIQUE (event_id);
    END IF;
END $$;
