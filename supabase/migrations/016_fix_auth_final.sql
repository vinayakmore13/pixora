-- Migration: 016_fix_auth_final.sql
-- Description: Fixes infinite RLS recursion by using a more robust is_admin check

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 2. Drop the existing function
DROP FUNCTION IF EXISTS public.is_admin();

-- 3. Create a non-recursive is_admin function
-- This function uses SECURITY DEFINER and is owned by postgres to bypass RLS.
-- It also checks JWT metadata first for performance.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First check if the is_admin claim is in the JWT (faster, avoids DB query)
  IF (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true THEN
    RETURN true;
  END IF;

  -- Fallback to checking the profiles table
  -- We use a subquery that specifically targets the ID to minimize RLS impact
  -- Note: Since this is SECURITY DEFINER and owned by postgres, it will bypass RLS.
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- 4. Ensure the function is owned by postgres
ALTER FUNCTION public.is_admin() OWNER TO postgres;

-- 5. Create robust policies
-- Admins have full access
CREATE POLICY "Admins can do everything on profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_admin());

-- Everyone can view profiles (including their own)
-- We use a simple true condition for SELECT, which is safe for public profile viewing.
-- If privacy is needed, this could be restricted.
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Ensure handle_new_user doesn't fail due to RLS
-- (Already SECURITY DEFINER but good to ensure)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'couple'),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Verification log
SELECT 'Auth and RLS fix (migration 016) applied successfully' as status;
