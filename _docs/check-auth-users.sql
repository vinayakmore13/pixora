-- Check auth.users table and verify password
-- Run this in Supabase SQL Editor

-- Step 1: Check if user exists in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  encrypted_password,
  raw_user_meta_data
FROM auth.users
WHERE email = 'admin@weddinghub.com';

-- Step 2: Check if user exists in profiles
SELECT 
  id,
  email,
  full_name,
  user_type,
  is_admin
FROM public.profiles
WHERE email = 'admin@weddinghub.com';

-- Step 3: Test password verification
-- This will show if the password is correct
SELECT 
  crypt('Admin123!', encrypted_password) = encrypted_password as password_correct
FROM auth.users
WHERE email = 'admin@weddinghub.com';
