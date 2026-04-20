-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a selfie_descriptor column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_descriptor vector(128);

-- Create photo_faces table to store extracted faces from uploaded photos
CREATE TABLE IF NOT EXISTS public.photo_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE,
  face_descriptor vector(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.photo_faces ENABLE ROW LEVEL SECURITY;

-- Policies for photo_faces
CREATE POLICY "Photo faces are viewable by everyone."
  ON public.photo_faces FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert photo faces."
  ON public.photo_faces FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create a function to search for matching faces
CREATE OR REPLACE FUNCTION match_faces(query_embedding vector(128), match_threshold float, match_count int)
RETURNS TABLE (
  photo_id UUID,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    public.photo_faces.photo_id,
    1 - (public.photo_faces.face_descriptor <=> query_embedding) AS similarity
  FROM public.photo_faces
  WHERE 1 - (public.photo_faces.face_descriptor <=> query_embedding) > match_threshold
  ORDER BY public.photo_faces.face_descriptor <=> query_embedding
  LIMIT match_count;
END;
$$;
