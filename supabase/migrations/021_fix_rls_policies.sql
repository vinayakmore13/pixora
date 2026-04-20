-- Migration 021: Fix RLS Policies for Events Table
-- Ensures proper SELECT access for both authenticated and unauthenticated users

-- First, disable RLS temporarily to verify data exists
-- ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their events" ON public.events;
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Public can view event by guest_qr_code" ON public.events;
DROP POLICY IF EXISTS "Public can view events by QR code" ON public.events;
DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

-- Re-enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can read their own events
CREATE POLICY "Users can read their own events"
    ON public.events FOR SELECT
    USING (auth.uid() = user_id);

-- Policy 2: Public can read any event (for public event page)
-- Set to true to allow unauthenticated users to view events by QR code
CREATE POLICY "Public can read events"
    ON public.events FOR SELECT
    USING (true);

-- Policy 3: Authenticated users can create events
CREATE POLICY "Users can create events"
    ON public.events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy 4: Authenticated users can update their own events
CREATE POLICY "Users can update their own events"
    ON public.events FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy 5: Authenticated users can delete their own events
CREATE POLICY "Users can delete their own events"
    ON public.events FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
