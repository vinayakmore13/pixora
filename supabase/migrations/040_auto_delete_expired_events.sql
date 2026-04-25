-- Migration 040: Auto-delete expired events
-- Enables pg_cron and sets up a nightly job to delete events and their related data after 30 days.

-- 1. Enable pg_cron extension (This requires superuser, which Supabase UI/migrations support)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. Schedule the nightly cleanup
-- This will run at midnight (00:00) every day
SELECT cron.schedule(
  'auto-delete-expired-events',
  '0 0 * * *',
  $$
    DELETE FROM public.events 
    WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);

-- Note: Because tables like `photos`, `guest_registrations`, `guest_matches`, 
-- and `photo_selections` have foreign keys with `ON DELETE CASCADE` referencing 
-- `events.id`, deleting the event will automatically delete all associated data cleanly!
