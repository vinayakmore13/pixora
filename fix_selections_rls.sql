-- Drop the old potentially broken policies
DROP POLICY IF EXISTS "Event owners can manage selections" ON public.photo_selections;
DROP POLICY IF EXISTS "Event owners can view selection guests" ON public.photo_selection_guests;
DROP POLICY IF EXISTS "Event owners can view favorites" ON public.photo_favorites;

-- Recreate with proper NEW/OLD binding and user matching
CREATE POLICY "Event owners can manage selections"
    ON public.photo_selections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_id
            AND events.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_id
            AND events.user_id = auth.uid()
        )
    );

CREATE POLICY "Event owners can view selection guests"
    ON public.photo_selection_guests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            JOIN public.photo_selections ON events.id = photo_selections.event_id
            WHERE photo_selections.id = selection_id
            AND events.user_id = auth.uid()
        )
    );

CREATE POLICY "Event owners can view favorites"
    ON public.photo_favorites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            JOIN public.photo_selections ON events.id = photo_selections.event_id
            WHERE photo_selections.id = selection_id
            AND events.user_id = auth.uid()
        )
    );

-- And just in case camera_sync wasn't applied properly either, let's make sure its columns exist
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS camera_sync_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS camera_sync_enabled BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
