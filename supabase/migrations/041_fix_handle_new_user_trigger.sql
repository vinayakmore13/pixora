-- Migration 041: Fix profile creation trigger and backfill missing profiles
-- Resolves an issue where user_type constraint violations caused silent profile creation failures.

-- 1. Backfill missing public.profiles from auth.users (covers users who failed the trigger)
INSERT INTO public.profiles (id, email, full_name, user_type, is_admin)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', ''), 
  CASE WHEN COALESCE(raw_user_meta_data->>'user_type', '') = 'photographer' THEN 'photographer' ELSE 'couple' END,
  COALESCE((raw_user_meta_data->>'is_admin')::boolean, false)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 2. Backfill missing photographer_profiles for any photographers
INSERT INTO public.photographer_profiles (id)
SELECT id FROM public.profiles 
WHERE user_type = 'photographer' 
AND id NOT IN (SELECT id FROM public.photographer_profiles);

-- 3. Replace the handle_new_user trigger function to be completely resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles ensuring user_type is strictly 'couple' or 'photographer'
  INSERT INTO public.profiles (id, email, full_name, user_type, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', '') = 'photographer' THEN 'photographer' ELSE 'couple' END,
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  );

  -- Auto-create photographer_profiles entry for photographers
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', '') = 'photographer' THEN
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

SELECT 'Migration 041: Resilient profile trigger and backfill applied successfully' as status;
