-- Migration 032: Auto-match guest on registration
-- Creates a trigger to automatically find and insert matches for a guest 
-- against existing photos when they register with a selfie.

CREATE OR REPLACE FUNCTION match_guest_on_registration()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.selfie_embedding IS NOT NULL THEN
        INSERT INTO public.guest_matches (guest_id, photo_id, event_id, similarity)
        SELECT 
            NEW.id,
            m.photo_id,
            NEW.event_id,
            m.similarity
        FROM public.match_embeddings(
            NEW.selfie_embedding, 
            0.6, -- threshold
            100, -- max matches 
            NEW.event_id
        ) m;
        
        -- Update guest status to matched if matches were found
        -- We just update it to 'processed' essentially, but lets just leave it or set to matched
        -- UPDATE public.guest_registrations SET status = 'matched' WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_match_guest_on_registration ON public.guest_registrations;
CREATE TRIGGER trigger_match_guest_on_registration
AFTER INSERT ON public.guest_registrations
FOR EACH ROW
EXECUTE FUNCTION match_guest_on_registration();

