-- Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create admin_audit_log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT, -- 'user', 'event', 'booking'
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create a function to check admin status without recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update profiles RLS to allow admins full access using the function (no recursion)
CREATE POLICY "Admins can do everything on profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_admin());

-- Also update the admin audit log policies to use the function
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_log;

CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.is_admin());

-- Create a view for admin stats
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles WHERE user_type = 'couple') as total_couples,
  (SELECT COUNT(*) FROM public.profiles WHERE user_type = 'photographer') as total_photographers,
  (SELECT COUNT(*) FROM public.events) as total_events,
  (SELECT COUNT(*) FROM public.events WHERE event_date >= DATE_TRUNC('month', NOW())) as events_this_month,
  (SELECT COALESCE(SUM(total_price), 0) FROM public.bookings WHERE status = 'completed') as total_revenue,
  (SELECT COALESCE(SUM(total_price), 0) * 0.15 FROM public.bookings WHERE status = 'completed') as platform_commission;

-- Grant access to admin_stats view
GRANT SELECT ON public.admin_stats TO authenticated;
