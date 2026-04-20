# Database Fix Instructions

## Problem
The Marketplace page is failing with error:
```
column photographer_profiles.location does not exist
```

## Solution
A database migration has been created at:
[`supabase/migrations/010_fix_database_issues.sql`](supabase/migrations/010_fix_database_issues.sql:1)

## How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)
If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd e:/web/wedhub-main (1)/wedhub-main

# Apply the migration
supabase migration up
```

### Option 2: Using Supabase Dashboard (Manual)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Copy and paste the contents of [`supabase/migrations/010_fix_database_issues.sql`](supabase/migrations/010_fix_database_issues.sql:1)
5. Click **Run** to execute the SQL

### Option 3: Using psql (Advanced)
If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f supabase/migrations/010_fix_database_issues.sql
```

## What This Migration Does

1. **Adds `location` column** to `photographer_profiles` table
   - Fixes: "column photographer_profiles.location does not exist" error

2. **Fixes `handle_new_user()` function**
   - Adds error handling to prevent user creation failures
   - Fixes: "Database error saving new user" error

3. **Ensures trigger exists**
   - Automatically creates profile when new user signs up

4. **Adds missing columns** to `profiles` table:
   - `selfie_descriptor` - For AI face recognition feature
   - `is_admin` - For admin access control

5. **Grants proper permissions**
   - Ensures anon and authenticated users can access tables

## Verification

After applying the migration:

1. **Test Marketplace page:**
   - Navigate to `/marketplace`
   - Should load without errors
   - Photographers should display correctly

2. **Test User Signup:**
   - Navigate to `/signup`
   - Create a new account
   - Should complete without "Database error saving new user"

3. **Test User Signin:**
   - Navigate to `/signin`
   - Login with credentials
   - Should work without "Invalid login credentials" (if credentials are correct)

## Troubleshooting

### If migration fails:
- Check that you have proper permissions on the Supabase project
- Ensure the database is not in read-only mode
- Check Supabase logs for detailed error messages

### If Marketplace still shows error:
- Verify the `location` column exists:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'photographer_profiles';
  ```
- Should include `location` in the results

### If signup still fails:
- Check that the trigger exists:
  ```sql
  SELECT trigger_name FROM information_schema.triggers 
  WHERE trigger_name = 'on_auth_user_created';
  ```
- Should return one row

## Files Reference

- **Migration File:** [`supabase/migrations/010_fix_database_issues.sql`](supabase/migrations/010_fix_database_issues.sql:1)
- **Audit Report:** [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md:1)
- **Fixes Applied:** [`FIXES_APPLIED.md`](FIXES_APPLIED.md:1)
