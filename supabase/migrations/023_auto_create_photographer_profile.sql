-- Migration: 023_auto_create_photographer_profile.sql
-- Description: Auto-create photographer_profiles entry when a photographer signs up,
-- and backfill any existing photographers who are missing one.

-- ============================================
-- 1. Backfill: Create photographer_profiles for any existing photographers missing one
-- ============================================
INSERT INTO public.photographer_profiles (id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.photographer_profiles pp ON pp.id = p.id
WHERE p.user_type = 'photographer'
AND pp.id IS NULL;

-- ============================================
-- 2. Update the handle_new_user trigger to also create photographer_profiles
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  );

  -- Auto-create photographer_profiles entry for photographers
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'user') = 'photographer' THEN
    INSERT INTO public.photographer_profiles (id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migration 023: Auto-create photographer_profiles applied successfully' as status;
