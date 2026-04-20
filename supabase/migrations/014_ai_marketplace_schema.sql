-- AI Marketplace Schema & Matching System
-- Tracks preferences, matches, and enables smart recommendations

-- 1. Client Preferences (for AI matching)
CREATE TABLE IF NOT EXISTS public.client_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_styles TEXT[] DEFAULT '{}', -- Weddings, Portraits, Events, etc.
  preferred_locations TEXT[] DEFAULT '{}', -- Cities/regions
  budget_min INTEGER,
  budget_max INTEGER,
  event_type VARCHAR(100), -- Wedding, Engagement, Birthday, etc.
  preferred_experience_years INTEGER, -- Min years experience
  preferences_json JSONB DEFAULT '{}', -- Custom preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id)
);

-- 2. Photographer Preferences (what they want to shoot)
CREATE TABLE IF NOT EXISTS public.photographer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  preferred_event_types TEXT[] DEFAULT '{}', -- Types they love
  prefers_locations TEXT[] DEFAULT '{}', -- Preferred regions
  min_budget INTEGER, -- Minimum price point they're comfortable with
  max_bookings_per_month INTEGER DEFAULT 10,
  availability_json JSONB DEFAULT '{}', -- Availability calendar
  preferences_json JSONB DEFAULT '{}', -- Custom preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(photographer_id)
);

-- 3. Marketplace Matches (AI-generated recommendations)
CREATE TABLE IF NOT EXISTS public.marketplace_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2) DEFAULT 0.0, -- 0-100 score
  style_match NUMERIC(5,2) DEFAULT 0.0, -- How well styles align
  budget_match NUMERIC(5,2) DEFAULT 0.0, -- Budget compatibility
  location_match NUMERIC(5,2) DEFAULT 0.0, -- Location proximity
  availability_match NUMERIC(5,2) DEFAULT 0.0, -- Time availability match
  match_reason TEXT, -- Why they're matched
  match_type VARCHAR(50) DEFAULT 'ai', -- ai, manual, suggested
  status VARCHAR(50) DEFAULT 'pending', -- pending, viewed, interested, rejected
  viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, photographer_id)
);

-- 4. Marketplace Trends & Analytics
CREATE TABLE IF NOT EXISTS public.marketplace_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_date DATE DEFAULT CURRENT_DATE,
  style VARCHAR(100), -- Weddings, Portraits, etc.
  search_volume INTEGER DEFAULT 0,
  matches_created INTEGER DEFAULT 0,
  bookings_completed INTEGER DEFAULT 0,
  avg_match_score NUMERIC(5,2),
  trending_rank INTEGER, -- 1 = most trending
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Client Search History (for personalization)
CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT,
  filters_json JSONB, -- Applied filters
  results_count INTEGER,
  clicked_photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photographer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Client Preferences
CREATE POLICY "Users can view own preferences" ON public.client_preferences
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Users can update own preferences" ON public.client_preferences
  FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Users can insert own preferences" ON public.client_preferences
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Photographer Preferences
CREATE POLICY "Photographers can view own preferences" ON public.photographer_preferences
  FOR SELECT USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can manage own preferences" ON public.photographer_preferences
  FOR UPDATE USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can insert own preferences" ON public.photographer_preferences
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);

-- Marketplace Matches (Two-way access)
CREATE POLICY "Users can view their matches" ON public.marketplace_matches
  FOR SELECT USING (
    auth.uid() = client_id OR 
    auth.uid() IN (
      SELECT photographer_id FROM public.photographer_profiles 
      WHERE id = marketplace_matches.photographer_id
    )
  );
CREATE POLICY "System can insert matches" ON public.marketplace_matches
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update match status" ON public.marketplace_matches
  FOR UPDATE USING (
    auth.uid() = client_id OR 
    auth.uid() IN (
      SELECT photographer_id FROM public.photographer_profiles 
      WHERE id = marketplace_matches.photographer_id
    )
  );

-- Marketplace Trends (Everyone can view)
CREATE POLICY "Trends are viewable by everyone" ON public.marketplace_trends
  FOR SELECT USING (true);

-- Search History (Users can view own)
CREATE POLICY "Users can view own search history" ON public.search_history
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Users can insert own search history" ON public.search_history
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Indexes for performance
CREATE INDEX idx_marketplace_matches_client_id ON public.marketplace_matches(client_id);
CREATE INDEX idx_marketplace_matches_photographer_id ON public.marketplace_matches(photographer_id);
CREATE INDEX idx_marketplace_matches_score ON public.marketplace_matches(match_score DESC);
CREATE INDEX idx_marketplace_matches_status ON public.marketplace_matches(status);
CREATE INDEX idx_client_preferences_client_id ON public.client_preferences(client_id);
CREATE INDEX idx_photographer_preferences_photographer_id ON public.photographer_preferences(photographer_id);
CREATE INDEX idx_search_history_client_id ON public.search_history(client_id);
CREATE INDEX idx_marketplace_trends_date ON public.marketplace_trends(trend_date);

-- Grants
GRANT ALL ON public.client_preferences TO anon, authenticated;
GRANT ALL ON public.photographer_preferences TO anon, authenticated;
GRANT ALL ON public.marketplace_matches TO anon, authenticated;
GRANT ALL ON public.marketplace_trends TO anon, authenticated;
GRANT ALL ON public.search_history TO anon, authenticated;
