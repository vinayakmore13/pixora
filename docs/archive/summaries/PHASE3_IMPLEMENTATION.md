# Phase 3: Photo Upload System - Implementation Guide

## Overview
This document describes the implementation of Phase 3 of the Photo Upload System for WedHub. The implementation adds comprehensive photo upload functionality with password verification, session management, image compression, and progress tracking.

## Files Created/Modified

### Database Migrations
1. **`supabase/migrations/003_create_photos_and_sessions.sql`**
   - Creates `upload_sessions` table for managing upload sessions
   - Creates `photos` table for storing photo metadata
   - Adds RLS policies for secure access
   - Creates functions for session validation and cleanup

2. **`supabase/migrations/004_setup_storage_bucket.sql`**
   - Sets up Supabase Storage bucket for photos
   - Configures file size limits (50MB) and allowed MIME types
   - Adds RLS policies for storage access

### Edge Functions
3. **`supabase/functions/verify-upload-password/index.ts`**
   - Verifies upload password using bcrypt comparison
   - Creates upload session with 24-hour expiration
   - Returns session token for subsequent uploads

### Utility Libraries
4. **`src/lib/uploadSession.ts`**
   - Functions for verifying upload passwords
   - Session validation and management
   - LocalStorage integration for session persistence

5. **`src/lib/imageCompression.ts`**
   - Client-side image compression using Canvas API
   - Maintains aspect ratio while resizing to max dimensions
   - Configurable quality and output format
   - Parallel compression support

6. **`src/lib/uploadManager.ts`**
   - Manages parallel uploads with configurable concurrency (default: 3)
   - Queue-based upload system
   - Progress tracking for each file
   - Automatic compression before upload
   - Saves metadata to database after successful upload

7. **`src/lib/photoMetadata.ts`**
   - CRUD operations for photo metadata
   - Public URL generation for photos
   - Photo approval management for guest uploads

### Components
8. **`src/components/UploadPhotos.tsx`** (Modified)
   - Added drag & drop functionality
   - Integrated with UploadManager for actual uploads
   - Real-time progress tracking
   - Event and album selection
   - File compression status display

## Key Features

### 1. Password Verification
- Uses bcrypt for secure password comparison
- Creates time-limited upload sessions (24 hours)
- Session tokens stored in database and localStorage

### 2. Upload Session Management
- Sessions automatically expire after 24 hours
- Cleanup function to remove expired sessions
- Validation function to check session validity

### 3. Supabase Storage Integration
- Photos stored in 'photos' bucket
- Organized by event ID: `{event_id}/{timestamp}-{random}.{ext}`
- Public access for viewing
- RLS policies for secure upload/delete

### 4. Drag & Drop Upload
- Visual feedback during drag operations
- Click-to-select fallback
- Multiple file selection support
- Image file filtering (JPG, PNG, HEIC, WebP)

### 5. Client-Side Image Compression
- Automatic compression before upload
- Max dimensions: 2048x2048 pixels
- Quality: 85% JPEG
- Shows compression savings in UI

### 6. Upload Progress Tracking
- Real-time progress for each file
- Status indicators: Pending, Compressing, Uploading, Saving, Completed, Error
- Overall progress percentage
- Parallel uploads (3 concurrent by default)

### 7. Photo Metadata Storage
- Stores file name, path, size, type
- Records image dimensions (width/height)
- Tracks uploader and upload session
- Supports guest upload approval workflow

## Usage

### For Event Owners
1. Navigate to Upload Photos page
2. Select an event from dropdown
3. Select or create an album
4. Drag & drop photos or click to select
5. Click "Start Upload" to begin
6. Monitor progress in real-time

### For Guests (via QR Code)
1. Scan event QR code
2. Enter upload password
3. Upload photos (requires approval by default)
4. Session expires after 24 hours

## Database Schema

### upload_sessions
```sql
- id: UUID (PK)
- event_id: UUID (FK to events)
- session_token: TEXT (unique)
- expires_at: TIMESTAMP
- created_at: TIMESTAMP
- is_valid: BOOLEAN
```

### photos
```sql
- id: UUID (PK)
- event_id: UUID (FK to events)
- uploader_id: UUID (FK to auth.users, nullable)
- upload_session_id: UUID (FK to upload_sessions, nullable)
- file_name: TEXT
- file_path: TEXT
- file_size: INTEGER
- file_type: TEXT
- width: INTEGER
- height: INTEGER
- thumbnail_url: TEXT (nullable)
- is_approved: BOOLEAN
- is_guest_upload: BOOLEAN
- uploaded_at: TIMESTAMP
- created_at: TIMESTAMP
```

## Security

### Row Level Security (RLS)
- Event owners can view/manage their photos
- Public can view photos (for guest access)
- Authenticated users can upload photos
- Event owners can delete their photos

### Storage Policies
- Authenticated users can upload to photos bucket
- Public can view photos
- Event owners can delete their photos

## Environment Variables
No new environment variables required. Uses existing Supabase configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deployment Steps

1. **Run Database Migrations**
   ```bash
   supabase migration up
   ```

2. **Deploy Edge Function**
   ```bash
   supabase functions deploy verify-upload-password
   ```

3. **Set Edge Function Secrets**
   ```bash
   supabase secrets set SUPABASE_URL=your_url
   supabase secrets set SUPABASE_ANON_KEY=your_key
   ```

4. **Verify Storage Bucket**
   - Check Supabase Dashboard > Storage
   - Confirm 'photos' bucket exists with correct policies

## Testing

### Test Password Verification
```typescript
import { verifyUploadPassword } from './lib/uploadSession';

const result = await verifyUploadPassword(eventId, 'your-password');
if (result.success) {
  console.log('Session token:', result.sessionToken);
}
```

### Test Image Compression
```typescript
import { compressImage } from './lib/imageCompression';

const compressed = await compressImage(file, {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
});
console.log('Saved:', compressed.originalSize - compressed.compressedSize, 'bytes');
```

### Test Upload Manager
```typescript
import { UploadManager } from './lib/uploadManager';

const manager = new UploadManager(eventId, {
  maxConcurrent: 3,
  onProgress: (progress) => console.log(progress),
  onComplete: (result) => console.log(result),
});

manager.addFiles([file1, file2, file3]);
await manager.startUpload();
```

## Future Enhancements
- Thumbnail generation on upload
- EXIF data extraction
- Batch download functionality
- Advanced image filters
- Album management UI
- Guest upload moderation queue
