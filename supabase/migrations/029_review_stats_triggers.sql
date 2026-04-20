-- Function to update photographer rating and review count
CREATE OR REPLACE FUNCTION public.fn_update_photographer_rating_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_photographer_id UUID;
BEGIN
    -- Determine the photographer_id to update
    IF (TG_OP = 'DELETE') THEN
        target_photographer_id := OLD.photographer_id;
    ELSE
        target_photographer_id := NEW.photographer_id;
    END IF;

    -- Update photographer_profiles with new stats
    UPDATE public.photographer_profiles
    SET 
        rating = COALESCE((
            SELECT AVG(rating)::NUMERIC(3,2)
            FROM public.reviews
            WHERE photographer_id = target_photographer_id
        ), 0.0),
        reviews_count = (
            SELECT COUNT(*)
            FROM public.reviews
            WHERE photographer_id = target_photographer_id
        ),
        updated_at = NOW()
    WHERE id = target_photographer_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats on review changes
DROP TRIGGER IF EXISTS tr_update_photographer_stats ON public.reviews;
CREATE TRIGGER tr_update_photographer_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_photographer_rating_stats();

-- Enable Realtime for relevant tables
ALTER TABLE public.photographer_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;

-- Ensure tables are in the supabase_realtime publication
DO $$
DECLARE
    pub_exists BOOLEAN;
BEGIN
    -- Check if publication exists
    SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
    
    IF NOT pub_exists THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables to publication if they are not already there
    -- We ignore errors if they are already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.photographer_profiles;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Table photographer_profiles already in publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Table reviews already in publication';
    END;
END $$;

-- Fix the relationship between reviews and profiles
-- This is necessary for Supabase/PostgREST to perform joins correctly in the frontend
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS reviews_client_id_fkey,
ADD CONSTRAINT reviews_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
