-- Fix for infinite RLS recursion in is_admin
-- 1. Drop existing policy that has the potential to recurse
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;

-- 2. Drop the existing function
DROP FUNCTION IF EXISTS public.is_admin();

-- 3. Recreate the function properly ensuring it bypasses RLS
-- Using LANGUAGE SQL instead of plpgsql for better performance inlineability.
-- Setting search_path to public prevents search_path hijacking.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 4. Explicitly make sure the function is owned by postgres, the default Supabase superuser bypassRLS role.
ALTER FUNCTION public.is_admin() OWNER TO postgres;

-- 5. Re-add the policy
CREATE POLICY "Admins can do everything on profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_admin());
