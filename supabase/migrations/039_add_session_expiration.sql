-- Add expires_at to fast_selection_sessions
ALTER TABLE public.fast_selection_sessions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');

-- Index for cleanup performance
CREATE INDEX IF NOT EXISTS idx_fast_selection_sessions_expires_at ON public.fast_selection_sessions(expires_at);
