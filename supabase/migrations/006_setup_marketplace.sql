-- Phase 6: Photographer Marketplace Schema

-- 1. Photographer Profiles
CREATE TABLE IF NOT EXISTS public.photographer_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio TEXT,
  location TEXT,
  languages TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  price_starts_at INTEGER,
  cover_photo_url TEXT,
  styles TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0.0,
  reviews_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Packages
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb, -- Array of strings
  is_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Portfolio Images
CREATE TABLE IF NOT EXISTS public.portfolio_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_amount INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID REFERENCES public.photographer_profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.photographer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_photographer_profiles_modtime
BEFORE UPDATE ON public.photographer_profiles
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_bookings_modtime
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS Policies

-- Photographer Profiles
-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.photographer_profiles
  FOR SELECT USING (true);
-- Photographers can update their own profile
CREATE POLICY "Photographers can update their own profile" ON public.photographer_profiles
  FOR UPDATE USING (auth.uid() = id);
-- Photographers can insert their own profile
CREATE POLICY "Photographers can insert their own profile" ON public.photographer_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Packages
-- Anyone can view packages
CREATE POLICY "Packages are viewable by everyone" ON public.packages
  FOR SELECT USING (true);
-- Photographers can manage their packages
CREATE POLICY "Photographers can insert packages" ON public.packages
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);
CREATE POLICY "Photographers can update their packages" ON public.packages
  FOR UPDATE USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can delete their packages" ON public.packages
  FOR DELETE USING (auth.uid() = photographer_id);

-- Portfolio Images
-- Anyone can view portfolio images
CREATE POLICY "Portfolio images are viewable by everyone" ON public.portfolio_images
  FOR SELECT USING (true);
-- Photographers can manage their portfolio images
CREATE POLICY "Photographers can insert portfolio images" ON public.portfolio_images
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);
CREATE POLICY "Photographers can update their portfolio images" ON public.portfolio_images
  FOR UPDATE USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can delete their portfolio images" ON public.portfolio_images
  FOR DELETE USING (auth.uid() = photographer_id);

-- Bookings
-- Clients can view their own bookings, photographers can view bookings for them
CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = photographer_id);
-- Clients can create bookings
CREATE POLICY "Clients can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = client_id);
-- Both can update (e.g., status changes)
CREATE POLICY "Users can update their own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = photographer_id);

-- Reviews
-- Anyone can view reviews
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
  FOR SELECT USING (true);
-- Clients can create reviews
CREATE POLICY "Clients can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);
-- Clients can update/delete their own reviews
CREATE POLICY "Clients can update their own reviews" ON public.reviews
  FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete their own reviews" ON public.reviews
  FOR DELETE USING (auth.uid() = client_id);

-- Grants
GRANT ALL ON public.photographer_profiles TO anon, authenticated;
GRANT ALL ON public.packages TO anon, authenticated;
GRANT ALL ON public.portfolio_images TO anon, authenticated;
GRANT ALL ON public.bookings TO anon, authenticated;
GRANT ALL ON public.reviews TO anon, authenticated;
