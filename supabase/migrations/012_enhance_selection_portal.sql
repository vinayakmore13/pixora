-- ============================================================================
-- MIGRATION 012: Enhance Selection Portal with Real-time, Tracking, Payments
-- ============================================================================
-- Date: 2026-03-30
-- Purpose: Add collaboration, download tracking, email notifications, orders
-- Created Tables: 4 new
-- Modified Tables: 3 existing
-- New Functions: 2 helper functions for analytics
-- ============================================================================

-- ============================================================================
-- PHASE 1: Extend Existing Tables (Idempotent - Safe to Run Multiple Times)
-- ============================================================================

-- Extend photo_selections with new features (check if columns exist first)
DO $$
BEGIN
  -- Check and add columns to photo_selections
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='status') THEN
    ALTER TABLE photo_selections ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired', 'archived'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='expires_at') THEN
    ALTER TABLE photo_selections ADD COLUMN expires_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='is_collaborative') THEN
    ALTER TABLE photo_selections ADD COLUMN is_collaborative BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='allow_comments') THEN
    ALTER TABLE photo_selections ADD COLUMN allow_comments BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='allow_voting') THEN
    ALTER TABLE photo_selections ADD COLUMN allow_voting BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='photographer_notes') THEN
    ALTER TABLE photo_selections ADD COLUMN photographer_notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='cover_photo_id') THEN
    ALTER TABLE photo_selections ADD COLUMN cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='updated_at') THEN
    ALTER TABLE photo_selections ADD COLUMN updated_at TIMESTAMP DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selections' AND column_name='created_at') THEN
    ALTER TABLE photo_selections ADD COLUMN created_at TIMESTAMP DEFAULT now();
  END IF;
END $$;

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_photo_selections_status ON photo_selections(status);
CREATE INDEX IF NOT EXISTS idx_photo_selections_expires_at ON photo_selections(expires_at);
CREATE INDEX IF NOT EXISTS idx_photo_selections_event_id ON photo_selections(event_id);

-- Extend photo_selection_guests with tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selection_guests' AND column_name='status') THEN
    ALTER TABLE photo_selection_guests ADD COLUMN status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'submitted'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selection_guests' AND column_name='last_activity') THEN
    ALTER TABLE photo_selection_guests ADD COLUMN last_activity TIMESTAMP DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selection_guests' AND column_name='is_active') THEN
    ALTER TABLE photo_selection_guests ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selection_guests' AND column_name='device_info') THEN
    ALTER TABLE photo_selection_guests ADD COLUMN device_info JSONB DEFAULT '{"type": "unknown"}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photo_selection_guests' AND column_name='version_shared_with') THEN
    ALTER TABLE photo_selection_guests ADD COLUMN version_shared_with INTEGER DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_selection_guests_status ON photo_selection_guests(status);
CREATE INDEX IF NOT EXISTS idx_photo_selection_guests_selection_id ON photo_selection_guests(selection_id);

-- Extend bookings table for payment support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
    ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_method') THEN
    ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_id') THEN
    ALTER TABLE bookings ADD COLUMN payment_id TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_paid') THEN
    ALTER TABLE bookings ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_due') THEN
    ALTER TABLE bookings ADD COLUMN amount_due DECIMAL(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='paid_at') THEN
    ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='receipt_url') THEN
    ALTER TABLE bookings ADD COLUMN receipt_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='updated_at') THEN
    ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMP DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_photographer_id ON bookings(photographer_id);

-- ============================================================================
-- PHASE 2: Create New Tables for Real-time Collaboration
-- ============================================================================

-- Track each individual selection (photo picked by guest)
CREATE TABLE IF NOT EXISTS selection_guest_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(guest_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_selection_guest_selections_selection ON selection_guest_selections(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_guest_selections_guest ON selection_guest_selections(guest_id);
CREATE INDEX IF NOT EXISTS idx_selection_guest_selections_photo ON selection_guest_selections(photo_id);
CREATE INDEX IF NOT EXISTS idx_selection_guest_selections_created ON selection_guest_selections(created_at);

-- Enable real-time subscriptions on this table
ALTER TABLE selection_guest_selections REPLICA IDENTITY FULL;

-- ============================================================================
-- PHASE 3: Create Download Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS selection_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  download_format VARCHAR(20) DEFAULT 'high_res' CHECK (download_format IN ('original', 'high_res', 'web')),
  photo_count INTEGER NOT NULL,
  file_size_mb DECIMAL(10, 2) DEFAULT 0,
  download_url TEXT NOT NULL,
  download_key VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accessed_at TIMESTAMP,
  accessed_count INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selection_downloads_selection ON selection_downloads(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_downloads_guest ON selection_downloads(guest_id);
CREATE INDEX IF NOT EXISTS idx_selection_downloads_created ON selection_downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_selection_downloads_expires ON selection_downloads(expires_at);
CREATE INDEX IF NOT EXISTS idx_selection_downloads_download_key ON selection_downloads(download_key);

-- ============================================================================
-- PHASE 4: Create Email Notification Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS selection_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('invite', 'reminder', 'ready', 'thank_you')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'clicked')),
  subject_line TEXT,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selection_notifications_selection ON selection_notifications(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_notifications_photographer ON selection_notifications(photographer_id);
CREATE INDEX IF NOT EXISTS idx_selection_notifications_status ON selection_notifications(status);
CREATE INDEX IF NOT EXISTS idx_selection_notifications_created ON selection_notifications(created_at);

-- ============================================================================
-- PHASE 5: Create Orders Table (Print Shop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal_cents INTEGER,
  commission_cents INTEGER DEFAULT 0,
  total_amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_selection ON orders(selection_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest ON orders(guest_id);
CREATE INDEX IF NOT EXISTS idx_orders_photographer ON orders(photographer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================================================
-- PHASE 6-10: RLS Policies (Drop and Recreate to Avoid Conflicts)
-- ============================================================================

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "guests_see_own_selections" ON selection_guest_selections;
  DROP POLICY IF EXISTS "photographers_see_guest_selections" ON selection_guest_selections;
  DROP POLICY IF EXISTS "guests_insert_own_selections" ON selection_guest_selections;
  DROP POLICY IF EXISTS "guests_delete_own_selections" ON selection_guest_selections;
  DROP POLICY IF EXISTS "guests_see_own_downloads" ON selection_downloads;
  DROP POLICY IF EXISTS "photographers_see_downloads" ON selection_downloads;
  DROP POLICY IF EXISTS "service_insert_downloads" ON selection_downloads;
  DROP POLICY IF EXISTS "photographers_see_own_notifications" ON selection_notifications;
  DROP POLICY IF EXISTS "service_insert_notifications" ON selection_notifications;
  DROP POLICY IF EXISTS "service_update_notifications" ON selection_notifications;
  DROP POLICY IF EXISTS "guests_see_own_orders" ON orders;
  DROP POLICY IF EXISTS "photographers_see_orders" ON orders;
  DROP POLICY IF EXISTS "service_manage_orders" ON orders;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if tables don't exist yet
END $$;

-- Enable RLS on new tables (if not already enabled)
ALTER TABLE selection_guest_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 7: RLS Policies - selection_guest_selections
-- ============================================================================

-- Guests see only their own selections
CREATE POLICY "guests_see_own_selections"
  ON selection_guest_selections
  FOR SELECT
  USING (
    guest_id IN (
      SELECT id FROM photo_selection_guests
      WHERE email = auth.jwt()->>'email'
    )
  );

-- Photographers see guest selections (verified in API layer)
CREATE POLICY "authenticated_select_selections"
  ON selection_guest_selections
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Guests can insert their own selections
CREATE POLICY "guests_insert_own_selections"
  ON selection_guest_selections
  FOR INSERT
  WITH CHECK (
    guest_id IN (
      SELECT id FROM photo_selection_guests
      WHERE email = auth.jwt()->>'email'
    )
  );

-- Guests can delete their own selections
CREATE POLICY "guests_delete_own_selections"
  ON selection_guest_selections
  FOR DELETE
  USING (
    guest_id IN (
      SELECT id FROM photo_selection_guests
      WHERE email = auth.jwt()->>'email'
    )
  );

-- ============================================================================
-- PHASE 8: RLS Policies - selection_downloads
-- ============================================================================

-- Guests see their own downloads
CREATE POLICY "guests_see_own_downloads"
  ON selection_downloads
  FOR SELECT
  USING (
    guest_id IN (
      SELECT id FROM photo_selection_guests
      WHERE email = auth.jwt()->>'email'
    )
  );

-- Photographers see downloads (verified in API layer)
CREATE POLICY "authenticated_view_downloads"
  ON selection_downloads
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can insert downloads (from API)
CREATE POLICY "service_insert_downloads"
  ON selection_downloads
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PHASE 9: RLS Policies - selection_notifications
-- ============================================================================

-- Photographers see their own notifications
CREATE POLICY "photographers_see_own_notifications"
  ON selection_notifications
  FOR SELECT
  USING (photographer_id = auth.uid());

-- Service role can insert notifications (from API)
CREATE POLICY "service_insert_notifications"
  ON selection_notifications
  FOR INSERT
  WITH CHECK (true);

-- Service role can update notification status (from webhooks)
CREATE POLICY "service_update_notifications"
  ON selection_notifications
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PHASE 10: RLS Policies - orders
-- ============================================================================

-- Guests see their own orders
CREATE POLICY "guests_see_own_orders"
  ON orders
  FOR SELECT
  USING (
    guest_id IN (
      SELECT id FROM photo_selection_guests
      WHERE email = auth.jwt()->>'email'
    )
  );

-- Photographers see orders for their selections
CREATE POLICY "photographers_see_orders"
  ON orders
  FOR SELECT
  USING (photographer_id = auth.uid());

-- Service role can insert/update orders (from API)
CREATE POLICY "service_manage_orders"
  ON orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PHASE 11: Helper Functions
-- ============================================================================

-- Function to get all photos with selection statistics
CREATE OR REPLACE FUNCTION get_selection_photos_with_stats(p_selection_id UUID)
RETURNS TABLE (
  photo_id UUID,
  photo_url TEXT,
  selection_count BIGINT,
  is_selected_by_guest BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.file_path,
    COUNT(sgs.id)::BIGINT,
    (COUNT(sgs.id) > 0)::BOOLEAN
  FROM photos p
  LEFT JOIN selection_guest_selections sgs ON p.id = sgs.photo_id
    AND sgs.selection_id = p_selection_id
  WHERE p.event_id = (
    SELECT event_id FROM photo_selections WHERE id = p_selection_id LIMIT 1
  )
  GROUP BY p.id, p.file_path
  ORDER BY COUNT(sgs.id) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get selection progress for photographer
CREATE OR REPLACE FUNCTION get_selection_progress(p_selection_id UUID)
RETURNS TABLE (
  total_guests BIGINT,
  submitted_guests BIGINT,
  pending_guests BIGINT,
  total_unique_photos BIGINT,
  submission_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT g.id)::BIGINT,
    COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'submitted')::BIGINT,
    COUNT(DISTINCT g.id) FILTER (WHERE g.status != 'submitted')::BIGINT,
    COUNT(DISTINCT sgs.photo_id)::BIGINT,
    ROUND(
      COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'submitted')::NUMERIC 
      / NULLIF(COUNT(DISTINCT g.id)::NUMERIC, 0) * 100,
      2
    )::NUMERIC
  FROM photo_selection_guests g
  LEFT JOIN selection_guest_selections sgs ON g.id = sgs.guest_id
  WHERE g.selection_id = p_selection_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 12: Verification
-- ============================================================================

-- Verify all tables created
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'selection_guest_selections',
    'selection_downloads',
    'selection_notifications',
    'orders'
  );
  
  IF table_count = 4 THEN
    RAISE NOTICE 'Migration 012: All 4 new tables created successfully';
  ELSE
    RAISE WARNING 'Migration 012: Expected 4 tables, found %', table_count;
  END IF;
END $$;

-- ============================================================================
-- END MIGRATION 012
-- ============================================================================
