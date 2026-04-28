-- Enhance photo_selections to include fast selection features
ALTER TABLE photo_selection_guests
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_code TEXT,
ADD COLUMN IF NOT EXISTS ai_unlocked_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' CHECK (status IN ('invited', 'accepted', 'submitted', 'completed')),
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop the old unique constraint and add new one for email
ALTER TABLE photo_selection_guests DROP CONSTRAINT IF EXISTS photo_selection_guests_selection_id_name_key;
ALTER TABLE photo_selection_guests ADD CONSTRAINT photo_selection_guests_selection_id_email_key UNIQUE (selection_id, email);

-- Fast Selection Pool and Security
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS is_in_selection_pool BOOLEAN DEFAULT false;
ALTER TABLE public.photo_selections ADD COLUMN IF NOT EXISTS is_secure_mode BOOLEAN DEFAULT true;
ALTER TABLE public.photo_selections ADD COLUMN IF NOT EXISTS max_views INTEGER DEFAULT 5;
ALTER TABLE public.photo_selections ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

