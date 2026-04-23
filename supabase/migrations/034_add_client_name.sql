-- Add name column to fast_selection_clients
ALTER TABLE fast_selection_clients ADD COLUMN IF NOT EXISTS name TEXT;
