-- Fix admin user authentication
-- The user exists in profiles but not in auth.users
-- This script creates the user in auth.users with the same ID

-- Step 1: Get the existing profile ID
DO $$
DECLARE
  profile_id UUID;
BEGIN
  SELECT id INTO profile_id FROM public.profiles WHERE email = 'admin@weddinghub.com';
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for admin@weddinghub.com';
  END IF;

  -- Step 2: Create the user in auth.users with the same ID
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    profile_id,  -- Use the same ID as the existing profile
    '00000000-0000-0000-0000-000000000000',
    'admin@weddinghub.com',
    crypt('Admin123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"WeddingHub Admin","user_type":"photographer"}'::jsonb,
    false,
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  RAISE NOTICE 'Admin user created in auth.users with ID: %', profile_id;
END $$;

-- Step 3: Verify the user was created
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  p.is_admin
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'admin@weddinghub.com';
