BEGIN;

-- Migration 048: User Roles Enhancement
-- Replaces couple/photographer binary with flexible role system

-- 1. Add new role system to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT 'individual' 
  CHECK (primary_role IN ('user', 'individual', 'photographer', 'group')),
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS relationship_status TEXT;

-- Backfill primary_role from existing user_type
UPDATE public.profiles
SET primary_role = CASE 
  WHEN user_type IN ('couple', 'user') THEN 'user'
  WHEN user_type = 'photographer' THEN 'photographer'
  ELSE 'individual'
END
WHERE primary_role IS NULL OR primary_role = 'individual';

-- 2. Create linked_accounts table
CREATE TABLE IF NOT EXISTS public.linked_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    linked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK (relationship_type IN ('spouse', 'family', 'friend', 'colleague')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(primary_user_id, linked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_primary ON linked_accounts(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_linked ON linked_accounts(linked_user_id);
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

-- Prevent circular relationships
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_duplicate_links') THEN
        ALTER TABLE linked_accounts ADD CONSTRAINT no_duplicate_links CHECK (primary_user_id < linked_user_id);
    END IF;
END $$;

-- 3. RLS Policies for linked_accounts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can link accounts') THEN
        CREATE POLICY "Users can link accounts" ON public.linked_accounts FOR INSERT WITH CHECK (auth.uid() = primary_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view linked accounts') THEN
        CREATE POLICY "Users can view linked accounts" ON public.linked_accounts FOR SELECT USING (auth.uid() = primary_user_id OR auth.uid() = linked_user_id);
    END IF;
END $$;

-- 4. Create user_groups table
CREATE TABLE IF NOT EXISTS public.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('family', 'friends', 'club', 'other')),
    admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID REFERENCES public.user_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS for groups
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Group admins can modify') THEN
        CREATE POLICY "Group admins can modify" ON public.user_groups FOR ALL USING (auth.uid() = admin_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Group members can view') THEN
        CREATE POLICY "Group members can view" ON public.user_groups FOR SELECT USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = user_groups.id AND user_id = auth.uid()));
    END IF;
END $$;

-- 5. Update events table for polymorphic ownership
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user' 
  CHECK (owner_type IN ('user', 'group')),
ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- Backfill existing events
UPDATE public.events 
SET owner_type = 'user', owner_id = user_id::text 
WHERE owner_id IS NULL;

-- 6. Client reference
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Backfill from couple_id/couple_name if columns exist
DO $$ 
BEGIN 
    -- Backfill client_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='couple_id') THEN
        UPDATE public.events SET client_id = couple_id::uuid WHERE client_id IS NULL AND couple_id IS NOT NULL;
    END IF;
    -- Backfill client_name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='couple_name') THEN
        UPDATE public.events SET client_name = couple_name WHERE client_name IS NULL AND couple_name IS NOT NULL;
    END IF;
END $$;

-- Final fallback for client_name
UPDATE public.events SET client_name = name WHERE client_name IS NULL;

-- 7. Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_profiles_primary_role ON profiles(primary_role);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON events(client_id);

-- 8. Create function to validate group members
CREATE OR REPLACE FUNCTION validate_group_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id = (
    SELECT admin_user_id FROM user_groups WHERE id = NEW.group_id
  ) THEN
    NEW.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_group_membership ON group_members;
CREATE TRIGGER tr_validate_group_membership
BEFORE INSERT OR UPDATE ON group_members
FOR EACH ROW EXECUTE FUNCTION validate_group_membership();

COMMIT;