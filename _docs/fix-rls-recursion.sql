-- Fix infinite recursion in profiles RLS policies
-- Run this in Supabase SQL Editor to fix the 500 authentication error

-- Step 1: Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;

-- Step 2: Create a function to check if a user is an admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Use SECURITY DEFINER to bypass RLS
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the admin policy using the function (no recursion)
CREATE POLICY "Admins can do everything on profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- Step 4: Also update the admin audit log policies to use the function
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_log;

CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Step 5: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;

-- Step 6: Verify the fix
SELECT 'RLS policies fixed successfully!' as status;
