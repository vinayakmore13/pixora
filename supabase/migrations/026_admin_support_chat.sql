-- Migration 026: Admin Support Chat
-- Allows conversations to be flagged as support and accessible by admins.

-- 1. Add is_support column
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT false;

-- 2. Relax photographer_id constraint
-- Since conversations could be with "Platform Support", photographer_id can be NULL
ALTER TABLE public.conversations 
ALTER COLUMN photographer_id DROP NOT NULL;

-- 3. Update UNIQUE constraint
-- We need to allow unique (client_id, photographer_id) for normal chats, 
-- but support chats are different.
-- For simplicity, we'll keep it as is if photographer_id is present, 
-- but ensure only one support chat per client.
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_client_id_photographer_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_support_chat_per_client 
ON public.conversations (client_id) 
WHERE (is_support = true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_normal_chats 
ON public.conversations (client_id, photographer_id) 
WHERE (is_support = false);

-- 4. Update RLS for Conversations
-- Drop existing policies to replace them with admin-aware ones
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

-- Participants can view, or any admin can view support chats
CREATE POLICY "Users and Admins view conversations" ON public.conversations
  FOR SELECT USING (
    auth.uid() = client_id OR 
    auth.uid() = photographer_id OR 
    (is_support = true AND public.is_admin())
  );

-- Users can start chats, or admins can start support responses
CREATE POLICY "Users and Admins create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = client_id OR 
    auth.uid() = photographer_id OR 
    (is_support = true AND public.is_admin())
  );

-- Participants/Admins can update (last_message_at etc.)
CREATE POLICY "Users and Admins update conversations" ON public.conversations
  FOR UPDATE USING (
    auth.uid() = client_id OR 
    auth.uid() = photographer_id OR 
    (is_support = true AND public.is_admin())
  );

-- 5. Update RLS for Messages
DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;

CREATE POLICY "Participants and Admins view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid() OR (c.is_support = true AND public.is_admin()))
    )
  );

CREATE POLICY "Participants and Admins send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid() OR (c.is_support = true AND public.is_admin()))
    )
  );

CREATE POLICY "Participants and Admins update messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid() OR (c.is_support = true AND public.is_admin()))
    )
  );
