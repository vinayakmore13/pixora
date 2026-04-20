# Supabase Setup Guide

This guide will help you set up Supabase for the PixEvent application.

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new Supabase project

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon/public** key (under Project API keys)

## Step 2: Configure Environment Variables

1. Create a `.env` file in the root directory of the project
2. Add the following variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Replace the values with your actual Supabase credentials.

## Step 3: Run Database Migrations

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_create_profiles.sql`
4. Paste it into the SQL Editor and click **Run**

This will:
- Create the `profiles` table
- Set up Row Level Security (RLS) policies
- Create a trigger to automatically create a profile when a user signs up

## Step 4: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under **Site URL**, add your application URL (e.g., `http://localhost:3000` for development)
3. Under **Redirect URLs**, add:
   - `http://localhost:3000` (for development)
   - Your production URL (when deploying)

### Optional: Enable OAuth Providers

To enable Google and Facebook login:

1. Go to **Authentication** → **Providers**
2. Enable **Google** and/or **Facebook**
3. Follow the instructions to configure each provider with your OAuth credentials

## Step 5: Test the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/signup`
3. Create a new account
4. Check your Supabase dashboard:
   - Go to **Authentication** → **Users** to see the new user
   - Go to **Table Editor** → **profiles** to see the auto-created profile

## Database Schema

### Profiles Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, references auth.users(id) |
| email | TEXT | User's email address |
| full_name | TEXT | User's full name |
| user_type | TEXT | Either 'couple' or 'photographer' |
| avatar_url | TEXT | URL to user's avatar image (optional) |
| created_at | TIMESTAMP | When the profile was created |
| updated_at | TIMESTAMP | When the profile was last updated |

## Row Level Security

The profiles table has the following RLS policies:

- **Public profiles are viewable by everyone**: Anyone can view profiles
- **Users can insert their own profile**: Users can only create their own profile
- **Users can update own profile**: Users can only update their own profile

## Troubleshooting

### "Missing Supabase environment variables" Error

Make sure you have created a `.env` file with the correct variable names:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Profile Not Created on Signup

1. Check that you ran the migration SQL script
2. Check the browser console for errors
3. Verify the trigger is created in your Supabase dashboard under **Database** → **Triggers**

### Authentication Not Working

1. Verify your Site URL and Redirect URLs are configured correctly
2. Check that your Supabase credentials are correct
3. Ensure your Supabase project is not paused

## Next Steps

After completing this setup, you can:

1. Add more fields to the profiles table as needed
2. Create additional tables for events, photos, etc.
3. Set up storage buckets for photo uploads
4. Configure email templates for authentication emails
