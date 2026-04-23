-- Add status column to fast_selection_clients
ALTER TABLE fast_selection_clients 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' CHECK (status IN ('invited', 'accepted', 'submitted', 'completed'));

-- Update any existing clients to 'accepted' if status is null
UPDATE fast_selection_clients SET status = 'accepted' WHERE status IS NULL;
