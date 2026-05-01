# Migration 049 Fix - Conditional Column Renaming

## Problem
Migration 049 failed because column `client_id` already existed (created by migration 048).

Error: `ERROR: 42701: column "client_id" of relation "events" already exists`

## Solution
Updated migration 049 to use conditional logic:

### Changes Made

1. **Conditional column renaming** (lines 4-18):
   ```sql
   -- Only rename couple_id to client_id if:
   --   couple_id EXISTS AND client_id DOESN'T EXIST
   IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'events' AND column_name = 'couple_id')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'events' AND column_name = 'client_id') THEN
     ALTER TABLE public.events RENAME COLUMN couple_id TO client_id;
   END IF;
   ```

2. **COALESCE in backward compat view** (lines 36, 37, 54):
   ```sql
   COALESCE(client_id, couple_id) AS couple_id
   ```
   Handles both old and new column names gracefully

3. **IF NOT EXISTS on indexes** (lines 21-22):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_events_client_id ON events(client_id);
   ```

## Status
✅ **FIXED - Migration now works regardless of migration 048 state**

The migration is idempotent and safe to run multiple times.
