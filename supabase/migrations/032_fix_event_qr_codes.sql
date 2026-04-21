-- Migration 032: Fix missing guest_qr_codes and ensure uniqueness
-- This handles legacy events that might have been created without a short code

-- 1. Create a function to generate random alphanumeric strings
CREATE OR REPLACE FUNCTION generate_random_qr_code(length INTEGER DEFAULT 8) 
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Update existing NULL or empty guest_qr_codes
-- We use a loop/subquery to ensure unique codes for each row
DO $$ 
DECLARE 
    r RECORD;
    new_code TEXT;
BEGIN 
    FOR r IN SELECT id FROM public.events WHERE guest_qr_code IS NULL OR guest_qr_code = '' LOOP
        LOOP
            new_code := generate_random_qr_code(8);
            -- Check for collision
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE guest_qr_code = new_code);
        END LOOP;
        
        UPDATE public.events SET guest_qr_code = new_code WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Add UNIQUE constraint to guest_qr_code if it doesn't have one
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'events_guest_qr_code_key'
    ) THEN
        ALTER TABLE public.events ADD CONSTRAINT events_guest_qr_code_key UNIQUE (guest_qr_code);
    END IF;
END $$;

-- 4. Ensure there is a search index for better performance
CREATE INDEX IF NOT EXISTS idx_events_guest_qr_code ON public.events (guest_qr_code);
