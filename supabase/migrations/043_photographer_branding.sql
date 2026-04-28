-- Migration: 043_photographer_branding.sql
-- Description: Add photographer branding/white-label support
-- Phase 1: Studio Profile, Watermark Settings, Contact Info, Lead Inquiries

-- ============================================
-- 1. Extend photographer_profiles with branding columns
-- ============================================

ALTER TABLE public.photographer_profiles
  ADD COLUMN IF NOT EXISTS studio_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7) DEFAULT '#FF6B6B',
  ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7) DEFAULT '#1A1F3A',
  ADD COLUMN IF NOT EXISTS watermark_type TEXT DEFAULT 'text' CHECK (watermark_type IN ('text', 'logo', 'logo_text')),
  ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'bottom_right' CHECK (watermark_position IN ('bottom_right', 'bottom_left', 'center')),
  ADD COLUMN IF NOT EXISTS watermark_opacity INTEGER DEFAULT 30 CHECK (watermark_opacity >= 10 AND watermark_opacity <= 60),
  ADD COLUMN IF NOT EXISTS watermark_size TEXT DEFAULT 'medium' CHECK (watermark_size IN ('small', 'medium', 'large')),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT '{}';

-- ============================================
-- 2. Add branding toggle to events table
-- ============================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_photographer_branding BOOLEAN DEFAULT TRUE;

-- ============================================
-- 3. Create lead_inquiries table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  event_date DATE,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_inquiries_photographer ON public.lead_inquiries(photographer_id);
CREATE INDEX IF NOT EXISTS idx_lead_inquiries_status ON public.lead_inquiries(status);

-- Enable RLS
ALTER TABLE public.lead_inquiries ENABLE ROW LEVEL SECURITY;

-- Policies: Photographers can view their own leads
CREATE POLICY "Photographers can view their leads"
  ON public.lead_inquiries FOR SELECT
  USING (auth.uid() = photographer_id);

-- Policies: Photographers can update their own leads (status changes)
CREATE POLICY "Photographers can update their leads"
  ON public.lead_inquiries FOR UPDATE
  USING (auth.uid() = photographer_id);

-- Policies: Anyone can submit a lead inquiry (guests are anonymous)
CREATE POLICY "Anyone can submit lead inquiry"
  ON public.lead_inquiries FOR INSERT
  WITH CHECK (true);

-- Grants
GRANT ALL ON public.lead_inquiries TO anon, authenticated;

-- ============================================
-- 4. Create storage bucket for studio logos
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-logos', 'studio-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for studio-logos bucket
CREATE POLICY "Anyone can view studio logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'studio-logos');

CREATE POLICY "Authenticated users can upload studio logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'studio-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own studio logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'studio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own studio logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'studio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

SELECT 'Migration 043: Photographer branding schema applied successfully' as status;
