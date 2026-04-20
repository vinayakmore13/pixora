-- Add processing_status to photos table to track async AI facial extraction progress
ALTER TABLE photos
ADD COLUMN processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed'));

-- Update existing rows to 'ready' since they already passed the previous synchronous flow
UPDATE photos SET processing_status = 'ready' WHERE processing_status = 'pending';
