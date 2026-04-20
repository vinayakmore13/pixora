-- Migration: Enhance Portfolio Images with metadata and engagement tracking

-- Add new columns to portfolio_images if they don't exist
ALTER TABLE public.portfolio_images 
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hash VARCHAR(64) UNIQUE;

-- Create an index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_portfolio_images_category ON public.portfolio_images(category);

-- Create an index on photographer_id for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolio_images_photographer_id ON public.portfolio_images(photographer_id);

-- Create an index on display_order for sorting
CREATE INDEX IF NOT EXISTS idx_portfolio_images_display_order ON public.portfolio_images(photographer_id, display_order);

-- Create a function to increment views
CREATE OR REPLACE FUNCTION increment_portfolio_views()
RETURNS TRIGGER AS $$
BEGIN
  NEW.views = COALESCE(NEW.views, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add default values for existing records if needed
UPDATE public.portfolio_images 
SET 
  title = COALESCE(title, 'Untitled'),
  category = COALESCE(category, 'Other'),
  likes = COALESCE(likes, 0),
  views = COALESCE(views, 0)
WHERE title IS NULL OR category IS NULL;
