-- Create fast_selection_photo_faces table
CREATE TABLE IF NOT EXISTS public.fast_selection_photo_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES public.fast_selection_photos(id) ON DELETE CASCADE,
  face_descriptor vector(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.fast_selection_photo_faces ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Fast photo faces viewable by everyone" ON public.fast_selection_photo_faces;
CREATE POLICY "Fast photo faces viewable by everyone" ON public.fast_selection_photo_faces FOR SELECT USING (true);

DROP POLICY IF EXISTS "Fast photo faces manageable by photographers" ON public.fast_selection_photo_faces;
CREATE POLICY "Fast photo faces manageable by photographers" ON public.fast_selection_photo_faces 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM fast_selection_photos p
    JOIN fast_selection_sessions s ON p.session_id = s.id
    WHERE p.id = fast_selection_photo_faces.photo_id
    AND s.photographer_id = auth.uid()
  )
);

-- Update match_faces function to search both tables
CREATE OR REPLACE FUNCTION match_faces(query_embedding vector(128), match_threshold float, match_count int)
RETURNS TABLE (
  photo_id UUID,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Combine results from both tables
  (
    SELECT
      f.photo_id,
      1 - (f.face_descriptor <=> query_embedding) AS similarity
    FROM public.photo_faces f
    WHERE 1 - (f.face_descriptor <=> query_embedding) > match_threshold
    
    UNION ALL
    
    SELECT
      ff.photo_id,
      1 - (ff.face_descriptor <=> query_embedding) AS similarity
    FROM public.fast_selection_photo_faces ff
    WHERE 1 - (ff.face_descriptor <=> query_embedding) > match_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
