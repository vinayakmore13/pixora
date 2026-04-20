-- Migration 028: Smart Share Link (AI Photo Access Link)
-- This migration adds support for secure AI-powered sharing links

-- 1. Create share_mode enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'share_auth_mode') THEN
        CREATE TYPE share_auth_mode AS ENUM ('password', 'otp');
    END IF;
END $$;

-- 2. Add share-related columns to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
ADD COLUMN IF NOT EXISTS share_mode share_auth_mode DEFAULT 'password';

-- 3. Create share_links table
CREATE TABLE IF NOT EXISTS public.share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    mode share_auth_mode DEFAULT 'password',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for share_links
CREATE INDEX IF NOT EXISTS idx_share_links_token ON public.share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_event_id ON public.share_links(event_id);

-- 4. Create access_logs table
CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    share_link_id UUID REFERENCES public.share_links(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT false,
    action_type TEXT, -- 'verify', 'match', 'download'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for access_logs
CREATE INDEX IF NOT EXISTS idx_access_logs_event_id ON public.access_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs(created_at);

-- 5. Update photos table for AI metadata (if not already handled)
-- Note: processing_status was added in migration 024

-- 6. Enable RLS on new tables
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- 7. Policies for share_links
DROP POLICY IF EXISTS "Event owners can manage share links" ON public.share_links;
CREATE POLICY "Event owners can manage share links"
    ON public.share_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = share_links.event_id 
            AND events.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Public can view active share links by token" ON public.share_links;
CREATE POLICY "Public can view active share links by token"
    ON public.share_links FOR SELECT
    USING (expires_at > NOW());

-- 8. Policies for access_logs
DROP POLICY IF EXISTS "Only admins and event owners can view access logs" ON public.access_logs;
CREATE POLICY "Only admins and event owners can view access logs"
    ON public.access_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = access_logs.event_id 
            AND events.user_id = auth.uid()
        )
    );

-- Insert policy for everyone to log access attempts (limited by backend logic)
DROP POLICY IF EXISTS "Anyone can insert access logs" ON public.access_logs;
CREATE POLICY "Anyone can insert access logs"
    ON public.access_logs FOR INSERT
    WITH CHECK (true);

-- 10. Create embeddings table as per specific user request
CREATE TABLE IF NOT EXISTS public.embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    vector vector(128) NOT NULL,
    face_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_photo_id ON public.embeddings(photo_id);

-- 11. Create function to search for matching embeddings
-- Using cosine distance (<=>)
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(128), 
  match_threshold float, 
  match_count int,
  target_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
  photo_id UUID,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.photo_id,
    1 - (e.vector <=> query_embedding) AS similarity
  FROM public.embeddings e
  JOIN public.photos p ON e.photo_id = p.id
  WHERE (target_event_id IS NULL OR p.event_id = target_event_id)
    AND 1 - (e.vector <=> query_embedding) > match_threshold
  ORDER BY e.vector <=> query_embedding
  LIMIT match_count;
END;
$$;
