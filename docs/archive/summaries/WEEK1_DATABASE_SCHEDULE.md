# 📅 WEEK 1 DETAILED BREAKDOWN: Selection Portal Foundation

## 🎯 Goal
By Friday EOD: Database + APIs + Mobile UI working end-to-end. Photographer can create portal → Guest selects photos → Real-time sync working.

---

## 🗓️ MONDAY & TUESDAY: DATABASE SCHEMA

### MONDAY Morning: Plan & Understand Current Schema

**What to Do:**
1. Open `supabase/migrations/` folder
2. Review existing migrations (001-011)
3. Understand current tables:
   - `photo_selections` (already exists!)
   - `photo_selection_guests` (already exists!)
   - What's missing: tracking table, downloads table, notifications table

**Current Structure (View It):**
```sql
-- EXISTING: photo_selections
id, event_id, photographer_id, max_photos, selection_code, created_at

-- EXISTING: photo_selection_guests  
id, selection_id, email, name, submitted_at

-- EXISTING: photo_favorites
id, guest_id, photo_id (basic selections)

-- MISSING: selection_guest_selections (detailed audit)
-- MISSING: selection_downloads (track access)
-- MISSING: selection_notifications (email tracking)
```

**Output:** Document in comment showing the gaps

---

### MONDAY Afternoon: Write Migration 012

**File to Create:** `supabase/migrations/012_enhance_selection_portal.sql`

**SQL to Write:**

```sql
-- ============================================================================
-- MIGRATION 012: Enhance Selection Portal with Tracking & Payments
-- ============================================================================
-- Date: 2026-03-30
-- Purpose: Add real-time collaboration, download tracking, payment support
-- Tables Created: 3 new
-- Tables Modified: 3 existing
-- ============================================================================

-- Phase 1: Extend existing tables with new columns
-- ============================================================================

ALTER TABLE photo_selections ADD COLUMN (
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired', 'archived')),
  expires_at TIMESTAMP,
  is_collaborative BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT false,
  allow_voting BOOLEAN DEFAULT false,
  photographer_notes TEXT,
  cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_photo_selections_status ON photo_selections(status);
CREATE INDEX idx_photo_selections_expires_at ON photo_selections(expires_at);

-- Update existing selections to have created_at if missing
ALTER TABLE photo_selections ADD COLUMN created_at TIMESTAMP DEFAULT now();

-- ============================================================================

ALTER TABLE photo_selection_guests ADD COLUMN (
  status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'submitted')),
  last_activity TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  device_info JSONB DEFAULT '{"type": "unknown"}',
  version_shared_with INTEGER DEFAULT 1
);

CREATE INDEX idx_photo_selection_guests_status ON photo_selection_guests(status);

-- ============================================================================

-- Phase 2: Create new tables for tracking
-- ============================================================================

-- Table: Detailed guest selections (audit trail)
-- Purpose: Track every photo selection action in real-time
CREATE TABLE selection_guest_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(guest_id, photo_id) -- Prevent duplicate selections from same guest
);

CREATE INDEX idx_selection_guest_selections_selection ON selection_guest_selections(selection_id);
CREATE INDEX idx_selection_guest_selections_guest ON selection_guest_selections(guest_id);
CREATE INDEX idx_selection_guest_selections_created ON selection_guest_selections(created_at);

-- ============================================================================

-- Table: Download tracking (who downloaded what, when)
CREATE TABLE selection_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  download_format VARCHAR(20) DEFAULT 'high_res' CHECK (download_format IN ('original', 'high_res', 'web')),
  photo_count INTEGER NOT NULL,
  file_size_mb DECIMAL DEFAULT 0,
  download_url TEXT NOT NULL,
  download_key VARCHAR(255) NOT NULL UNIQUE, -- For secure access
  expires_at TIMESTAMP NOT NULL,
  accessed_at TIMESTAMP,
  accessed_count INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_selection_downloads_selection ON selection_downloads(selection_id);
CREATE INDEX idx_selection_downloads_guest ON selection_downloads(guest_id);
CREATE INDEX idx_selection_downloads_created ON selection_downloads(created_at);
CREATE INDEX idx_selection_downloads_expires ON selection_downloads(expires_at);

-- ============================================================================

-- Table: Email notification tracking
CREATE TABLE selection_notifications (
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

CREATE INDEX idx_selection_notifications_selection ON selection_notifications(selection_id);
CREATE INDEX idx_selection_notifications_status ON selection_notifications(status);
CREATE INDEX idx_selection_notifications_created ON selection_notifications(created_at);

-- ============================================================================

-- Phase 3: Extend bookings table for payment support
-- ============================================================================

ALTER TABLE bookings ADD COLUMN (
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50), -- 'stripe', 'razorpay', 'transfer'
  payment_id TEXT, -- stripe_pi_xxx, razorpay_order_xxx
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  amount_due DECIMAL(10, 2) DEFAULT 0, 
  paid_at TIMESTAMP,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_created ON bookings(created_at);

-- ============================================================================

-- Phase 4: Create orders table for print shop
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES photo_selections(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES photo_selection_guests(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  items JSONB NOT NULL DEFAULT '[]', -- Array of {photo_id, format, quantity, price}
  subtotal_cents INTEGER, -- Total before commission
  commission_cents INTEGER DEFAULT 0, -- 8% to WebHub
  total_amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_orders_selection ON orders(selection_id);
CREATE INDEX idx_orders_guest ON orders(guest_id);
CREATE INDEX idx_orders_photographer ON orders(photographer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);

-- ============================================================================

-- Phase 5: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE selection_guest_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- policy: Guests see only their own selections
CREATE POLICY "guests_see_own_selections"
  ON selection_guest_selections
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM photo_sele...
      WHERE id = guest_id
    )
  );

-- Policy: Photographers see selections for their events
CREATE POLICY "photographers_see_guest_selections"
  ON selection_guest_selections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photo_selections ps
      WHERE ps.id = selection_id
      AND ps.photographer_id = auth.uid()
    )
  );

-- Similar policies for downloads, notifications, orders...
-- (Full policies in IMPLEMENTATION_PLAN)

-- ============================================================================
-- END MIGRATION 012
-- ============================================================================
```

**Output:** Migration file created + validated in Supabase

---

### TUESDAY Morning: Test & Validate Schema

**What to Do:**

1. **In Supabase Dashboard:**
   - Go to SQL Editor
   - Copy migration 012
   - Run it
   - Verify all tables created:
     ```sql
     \dt -- List all tables
     -- Should show: selection_guest_selections, selection_downloads, selection_notifications, orders
     ```

2. **Check columns added:**
   ```sql
   \d photo_selections
   -- Verify: status, expires_at, is_collaborative, cover_photo_id, updated_at
   
   \d photo_selection_guests
   -- Verify: status, last_activity, device_info
   \d orders
   -- Verify: 20+ columns for tracking
   ```

3. **Test RLS policies:**
   ```sql
   -- Run as guest user (not authenticated)
   SELECT * FROM selection_downloads;
   -- Should show: 0 rows (RLS blocking access)
   ```

**Output:** Database ready, all tables verified, RLS working

---

### TUESDAY Afternoon: Create Helper Functions

**File to Create:** `supabase/migrations/013_create_helper_functions.sql`

**Functions:**

```sql
-- Get all photos for a selection with statistics
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
    COUNT(sgs.id) FILTER (WHERE sgs.selection_id = p_selection_id),
    EXISTS (
      SELECT 1 FROM selection_guest_selections 
      WHERE guest_id = auth.uid() AND photo_id = p.id
    )
  FROM photos p
  LEFT JOIN selection_guest_selections sgs ON p.id = sgs.photo_id
  WHERE p.event_id IN (SELECT event_id FROM photo_selections WHERE id = p_selection_id)
  GROUP BY p.id, p.file_path;
END;
$$ LANGUAGE plpgsql;

-- Get selection progress for photographer
CREATE OR REPLACE FUNCTION get_selection_progress(p_selection_id UUID)
RETURNS TABLE (
  total_guests BIGINT,
  submitted_guests BIGINT,
  pending_guests BIGINT,
  total_unique_photos BIGINT,
  submission_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT g.id),
    COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'submitted'),
    COUNT(DISTINCT g.id) FILTER (WHERE g.status != 'submitted'),
    COUNT(DISTINCT sgs.photo_id),
    ROUND(
      COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'submitted')::DECIMAL 
      / COUNT(DISTINCT g.id)::DECIMAL * 100, 
      2
    )
  FROM photo_selection_guests g
  LEFT JOIN selection_guest_selections sgs ON g.id = sgs.guest_id
  WHERE g.selection_id = p_selection_id;
END;
$$ LANGUAGE plpgsql;
```

**Output:** Helper functions created for fast queries

---

## 📋 DELIVERABLES (MONDAY-TUESDAY)

**By End of Tuesday:**

- ✅ Migration 012 file created + run successfully
- ✅ All 4 new tables created (verified in DB)
- ✅ Columns added to existing tables
- ✅ RLS policies enabled
- ✅ Helper functions working
- ✅ Example queries tested

**Files Modified:**
- `supabase/migrations/012_enhance_selection_portal.sql` (NEW)
- `supabase/migrations/013_create_helper_functions.sql` (NEW)

**Test with:**
```bash
# In terminal, verify schema
curl -X POST https://your-supabase-url/functions/v1/schema-verify \
  -H "Authorization: Bearer your-token"
```

---

## 🎯 Commands to Run

```bash
# 1. Create migration file
touch supabase/migrations/012_enhance_selection_portal.sql

# 2. Copy the SQL above into that file

# 3. Push to Supabase
supabase db push

# 4. Verify
supabase db list-rows
```

---

## ✅ Checklist Before Moving to APIs

- [ ] All 4 new tables visible in Supabase dashboard
- [ ] `selection_guest_selections` has 0 rows (new)
- [ ] `selection_downloads` has 0 rows (new)
- [ ] `selection_notifications` has 0 rows (new)
- [ ] `orders` has 0 rows (new)
- [ ] `photo_selections` has status, expires_at columns
- [ ] `photo_selection_guests` has status, last_activity columns
- [ ] `bookings` has payment_status, payment_id columns
- [ ] RLS policies created (check in SQL editor)
- [ ] Helper functions created (test SELECT from function)

---

**When complete, move to WEDNESDAY: API Endpoints**
