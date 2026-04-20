-- Migration 027: Message Deletion Policies
-- Adds delete policies for messages and conversations

-- 1. Allow users to delete their own messages
CREATE POLICY "Users can delete own messages" ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- 2. Allow conversation participants to delete the conversation
-- (Due to ON DELETE CASCADE on the messages table foreign key, this will delete the messages as well)
CREATE POLICY "Users can delete conversations" ON public.conversations
  FOR DELETE
  USING (auth.uid() = client_id OR auth.uid() = photographer_id);
