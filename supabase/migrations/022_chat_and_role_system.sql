-- Migration 022: Chat System + Role-Based Event Ownership
-- Adds conversations, messages tables and photographer_id to events.
-- FULLY ADDITIVE — does NOT drop or rename any existing columns or tables.

-- ============================================
-- 1. Conversations Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, photographer_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Both participants can view their conversations
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = photographer_id);

-- Any authenticated user can start a conversation
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = photographer_id);

-- Participants can update their conversations (e.g. last_message_at)
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = photographer_id);

-- ============================================
-- 2. Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'event_created', 'booking_confirmed')),
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can view messages
CREATE POLICY "Conversation participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid())
    )
  );

-- Only conversation participants can send messages
CREATE POLICY "Conversation participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid())
    )
  );

-- Participants can update messages (for read receipts)
CREATE POLICY "Participants can update messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.photographer_id = auth.uid())
    )
  );

-- ============================================
-- ============================================
-- 3. Add photographer_id and couple_id to events (ADDITIVE ONLY)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name = 'photographer_id'
  ) THEN
    ALTER TABLE public.events ADD COLUMN photographer_id UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name = 'couple_id'
  ) THEN
    ALTER TABLE public.events ADD COLUMN couple_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- ============================================
-- 4. Update events RLS to allow photographer access
--    KEEP all existing policies, just ADD new ones
-- ============================================

-- Photographers can view events they are assigned to
DROP POLICY IF EXISTS "Photographers can view assigned events" ON public.events;
CREATE POLICY "Photographers can view assigned events" ON public.events
  FOR SELECT USING (auth.uid() = photographer_id);

-- Photographers can update events they are assigned to
DROP POLICY IF EXISTS "Photographers can update assigned events" ON public.events;
CREATE POLICY "Photographers can update assigned events" ON public.events
  FOR UPDATE USING (auth.uid() = photographer_id);

-- Photographers can create events (they set themselves as photographer_id)
DROP POLICY IF EXISTS "Photographers can create events" ON public.events;
CREATE POLICY "Photographers can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = photographer_id OR auth.uid() = couple_id);

-- ============================================
-- 5. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_photographer_id ON public.conversations(photographer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_photographer_id ON public.events(photographer_id);

-- Enable Realtime for messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
