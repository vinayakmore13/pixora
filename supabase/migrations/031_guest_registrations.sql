-- Migration 031: Guest Registration for AI Sharing
-- Adds support for event guests to register with selfies and receive matched photos in real-time.

-- 1. Create guest_registrations table
CREATE TABLE IF NOT EXISTS public.guest_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    selfie_embedding vector(128),
    status TEXT DEFAULT 'pending', -- 'pending', 'matched', 'delivered'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for event lookups
CREATE INDEX IF NOT EXISTS idx_guest_registrations_event_id ON public.guest_registrations(event_id);

-- 2. Create guest_matches table
CREATE TABLE IF NOT EXISTS public.guest_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES public.guest_registrations(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    similarity FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_guest_matches_guest_id ON public.guest_matches(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_matches_photo_id ON public.guest_matches(photo_id);
CREATE INDEX IF NOT EXISTS idx_guest_matches_event_id ON public.guest_matches(event_id);

-- 3. Enable RLS
ALTER TABLE public.guest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_matches ENABLE ROW LEVEL SECURITY;

-- 4. Policies for guest_registrations
DROP POLICY IF EXISTS "Anyone can register for an event" ON public.guest_registrations;
CREATE POLICY "Anyone can register for an event"
    ON public.guest_registrations FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Photographers can view registrations for their events" ON public.guest_registrations;
CREATE POLICY "Photographers can view registrations for their events"
    ON public.guest_registrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = guest_registrations.event_id
            AND events.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Guests can view their own registration" ON public.guest_registrations;
CREATE POLICY "Guests can view their own registration"
    ON public.guest_registrations FOR SELECT
    USING (id::text = auth.uid()::text OR true); -- Allowing public select for now for anonymous guests

-- 5. Policies for guest_matches
DROP POLICY IF EXISTS "Photographers can view matches for their events" ON public.guest_matches;
CREATE POLICY "Photographers can view matches for their events"
    ON public.guest_matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = guest_matches.event_id
            AND events.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Public can view matches (filtered by backend)" ON public.guest_matches;
CREATE POLICY "Public can view matches (filtered by backend)"
    ON public.guest_matches FOR SELECT
    USING (true);

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_registrations;

-- 7. Add event metrics view or helper function if needed (Optional)
