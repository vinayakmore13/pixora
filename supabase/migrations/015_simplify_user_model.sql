-- Migration 015: Update user model - rename couple to user
-- Replace 'couple' with 'user' in user_type field
-- Photographers remain as 'photographer'

-- 1. Update profiles table to change existing 'couple' values to 'user'
UPDATE public.profiles 
SET user_type = 'user' 
WHERE user_type = 'couple';

-- 2. Update the CHECK constraint on user_type column
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('user', 'photographer'));

-- 3. Update default trigger logic for new sign-ups (if applicable)
-- Future users will be created with 'user' as default instead of 'couple'

