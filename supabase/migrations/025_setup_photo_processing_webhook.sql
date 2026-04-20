-- Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger the edge function
CREATE OR REPLACE FUNCTION public.trigger_photo_processing()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  auth_header text;
BEGIN
  -- In local dev, this would be your local edge function URL: 'http://host.docker.internal:54321/functions/v1/process-photos'
  -- In production, ideally use the project edge function URL
  -- Using net.http_post for asynchronous calling (webhook)
  
  -- Select the appropriate URL (Assuming internal service role usage)
  -- Important: you will need to replace this if deploying to cloud, but Supabase UI Webhooks is visually easier.
  -- For this script we log the event and use pg_net for async push
  
  PERFORM net.http_post(
    url := 'http://host.docker.internal:8000/webhooks/photos/pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', current_setting('request.jwt.claim.role', true) -- Using the current token or you can set a service key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'photos',
      'schema', 'public',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the photos table
DROP TRIGGER IF EXISTS on_photo_insert_trigger ON photos;
CREATE TRIGGER on_photo_insert_trigger
  AFTER INSERT ON photos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_photo_processing();
