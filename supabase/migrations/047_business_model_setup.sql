-- Migration 047: Business Model Setup
-- Implements Storage-based pricing, Smart Share packs, and AI unlock flow logic

-- 1. Add billing columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'growth', 'professional')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS storage_limit BIGINT DEFAULT 536870912, -- 512MB for free tier
ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS smart_shares_remaining INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ai_credits_remaining INTEGER DEFAULT 1;

-- 2. Create function to calculate and update storage usage
CREATE OR REPLACE FUNCTION public.update_user_storage_usage()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    photo_size BIGINT;
BEGIN
    -- Get the event owner
    SELECT user_id INTO owner_id FROM public.events WHERE id = COALESCE(NEW.event_id, OLD.event_id);
    
    IF (TG_OP = 'INSERT') THEN
        photo_size := NEW.file_size;
        UPDATE public.profiles 
        SET storage_used = storage_used + photo_size
        WHERE id = owner_id;
    ELSIF (TG_OP = 'DELETE') THEN
        photo_size := OLD.file_size;
        UPDATE public.profiles 
        SET storage_used = GREATEST(0, storage_used - photo_size)
        WHERE id = owner_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger for storage usage
DROP TRIGGER IF EXISTS tr_update_storage_on_photo_change ON public.photos;
CREATE TRIGGER tr_update_storage_on_photo_change
AFTER INSERT OR DELETE ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.update_user_storage_usage();

-- 4. Create table for billing transactions (Packs and Upgrades)
CREATE TABLE IF NOT EXISTS public.billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    item_type TEXT NOT NULL CHECK (item_type IN ('plan_upgrade', 'smart_share_pack', 'ai_unlock')),
    item_id TEXT, -- plan name or pack id
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    payment_intent_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create table for AI Unlock Records
CREATE TABLE IF NOT EXISTS public.ai_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    photo_ids UUID[] NOT NULL,
    transaction_id UUID REFERENCES public.billing_transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable RLS
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_unlocks ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "Users can view their own transactions"
    ON public.billing_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Event owners can view unlocks for their events"
    ON public.ai_unlocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = ai_unlocks.event_id
            AND events.user_id = auth.uid()
        )
    );

-- 8. Seed default limits based on plans (Trigger to set limits on profile update)
CREATE OR REPLACE FUNCTION public.set_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.plan_type = 'starter') THEN
        NEW.storage_limit := 53687091200; -- 50GB
    ELSIF (NEW.plan_type = 'growth') THEN
        NEW.storage_limit := 161061273600; -- 150GB
        NEW.smart_shares_remaining := COALESCE(NEW.smart_shares_remaining, 0) + 10;
    ELSIF (NEW.plan_type = 'professional') THEN
        NEW.storage_limit := 322122547200; -- 300GB
    ELSIF (NEW.plan_type = 'free') THEN
        NEW.storage_limit := 536870912; -- 512MB
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_plan_limits ON public.profiles;
CREATE TRIGGER tr_set_plan_limits
BEFORE UPDATE OF plan_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_plan_limits();
