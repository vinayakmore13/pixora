-- Fix photographer access to session photos
DROP POLICY IF EXISTS "Photographers manage photos of their sessions" ON fast_selection_photos;

CREATE POLICY "Photographers manage photos of their sessions" ON fast_selection_photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM fast_selection_sessions
    WHERE fast_selection_sessions.id = fast_selection_photos.session_id
    AND fast_selection_sessions.photographer_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM fast_selection_sessions
    WHERE fast_selection_sessions.id = session_id
    AND fast_selection_sessions.photographer_id = auth.uid()
  )
);
