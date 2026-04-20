-- Migration 030: Photographer Favorites
-- Allows users to "heart" photographers and save them to their profile.

CREATE TABLE IF NOT EXISTS public.photographer_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photographer_id UUID NOT NULL REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, photographer_id)
);

-- Enable Row Level Security
ALTER TABLE public.photographer_favorites ENABLE ROW LEVEL SECURITY;

-- Users can manage their own favorites
CREATE POLICY "Users can view own favorites" 
    ON public.photographer_favorites FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" 
    ON public.photographer_favorites FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" 
    ON public.photographer_favorites FOR DELETE 
    USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.photographer_favorites;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_photographer_favorites_user_id ON public.photographer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_photographer_favorites_photographer_id ON public.photographer_favorites(photographer_id);
