-- Migration 029: AI Share Missing Tables
-- Enables pgvector and creates tables for sessions, registrations, and matching

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add missing column to share_links
ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. Create share_sessions table
CREATE TABLE IF NOT EXISTS public.share_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_link_id UUID REFERENCES public.share_links(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_sessions_token_hash ON public.share_sessions(session_token_hash);

-- 3. Create guest_registrations table for pre-registered guests (AI matching)
CREATE TABLE IF NOT EXISTS public.guest_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    contact_info TEXT, -- email or phone
    selfie_path TEXT,
    selfie_embedding vector(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_registrations_event_id ON public.guest_registrations(event_id);

-- 4. Create guest_matches table to store confirmed AI matches
CREATE TABLE IF NOT EXISTS public.guest_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guest_registrations(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    similarity FLOAT,
    confirmed BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guest_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_matches_event_id ON public.guest_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_matches_guest_id ON public.guest_matches(guest_id);

-- 5. Create share_otps table for OTP-based access
CREATE TABLE IF NOT EXISTS public.share_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_link_id UUID REFERENCES public.share_links(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_otps_link_id ON public.share_otps(share_link_id);

-- 6. Enable RLS
ALTER TABLE public.share_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_otps ENABLE ROW LEVEL SECURITY;

-- 7. Basic Policies (restricting to event owners/admins)
-- For simplicity, we allow service role to manage everything, 
-- and public access is restricted via backend logic.

CREATE POLICY "Service role can do everything" ON public.share_sessions FOR ALL USING (true);
CREATE POLICY "Service role can do everything" ON public.guest_registrations FOR ALL USING (true);
CREATE POLICY "Service role can do everything" ON public.guest_matches FOR ALL USING (true);
CREATE POLICY "Service role can do everything" ON public.share_otps FOR ALL USING (true);
