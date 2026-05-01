# Face API Model Loading Issue - Troubleshooting Guide

## Problem

You're seeing one of these errors:
```
[FaceAPI] Failed to load face API models: Error: Unexpected token '<', "<!doctype 
[FaceAPI] ✗ Failed to load ssdMobilenetv1: Unexpected token '<', "<!doctype "
[FaceAPI] Failed to load face API models: Error: Based on the provided shape, [3,3,256,256], 
the tensor should have 589824 values but has 146127
```

This means either:
1. **CDN is returning HTML error page** (404 or 500 error) - file not found or server issue
2. **Model files are corrupted/incomplete** - truncated or partially downloaded  
3. **Build process damaged files** - files were lost or damaged during build
4. **Git issues** - binary files stored incorrectly in version control

## Solutions

### Option 1: One-Command Recovery (Recommended)

**On Windows:**
```bash
recover-models.bat
```

**On Mac/Linux:**
```bash
bash recover-models.sh
```

These scripts will:
- ✓ Delete all corrupted model files
- ✓ Download fresh models from CDN
- ✓ Verify file integrity
- ✓ Show detailed progress (including file sizes and download %)
- ✓ Automatically restart your dev server instructions

This is the easiest solution - just run it and follow the prompts!

### Option 2: Manual Fix

If the scripts don't work:

```bash
# Delete corrupted models
rm -rf public/models
mkdir -p public/models

# Download fresh models
npm run download:models

# Restart dev server
npm run dev
```

### Option 3: Advanced Download

If you want to verify files are downloading correctly:

```bash
# Check model file sizes (should not be tiny)
ls -lh public/models/

# Expected files and typical sizes:
# ssd_mobilenetv1_model-weights_manifest.json     ~30KB
# ssd_mobilenetv1_model-shard1                    ~10MB
# ssd_mobilenetv1_model-shard2                    ~5MB
# face_landmark_68_model-weights_manifest.json    ~7KB
# face_landmark_68_model-shard1                   ~400KB
# face_recognition_model-weights_manifest.json    ~5KB
# face_recognition_model-shard1                   ~145MB  ← Large file!
# face_expression_model-weights_manifest.json     ~5KB
# face_expression_model-shard1                    ~600KB
```

If any files are significantly smaller than these sizes (especially `face_recognition_model-shard1`), they're corrupted.

## What Changed in Download Script

The updated download script now:
- ✅ **Tries multiple CDN sources** (unpkg → jsDelivr → GitHub)
- ✅ **Detects HTML responses** (404/50x errors) and retries with next CDN
- ✅ **Always re-downloads** (doesn't trust partial files)
- ✅ **Shows download progress** (%, MB/MB)
- ✅ **Verifies file sizes** (fails if file too small)
- ✅ **Has longer timeout** (120 seconds per file)
- ✅ **Better error messages** (tells you which CDN is being tried)

## Prevention

- **For Git**: Add to `.gitignore` to exclude large binary files:
  ```
  public/models/
  ```

- **For CI/CD**: Run `npm run download:models` during deployment instead of storing models in Git

- **For Development**: 
  - Don't edit model files - they're binary and will corrupt
  - Always use recovery scripts rather than manual downloads
  - Check file sizes are reasonable before restarting dev server

## What Happens After It's Fixed

1. Models load from `public/models/` (no CORS issues)
2. Face detection works offline
3. SelfieCapture component can extract face descriptors
4. User profiles can be created with face verification

## Still Having Issues?

If the recovery script fails with HTML error (`<!doctype` in error):

1. **This means the CDN is returning a 404 or 50x error** - The file doesn't exist at that CDN URL
2. **The script tries 3 CDN sources automatically:**
   - unpkg (most reliable)
   - jsDelivr
   - GitHub raw content
3. **If all CDNs fail:**
   - Check your internet connection
   - Check if CDNs are accessible: 
     ```bash
     ping unpkg.com
     ping cdn.jsdelivr.net
     ping raw.githubusercontent.com
     ```
   - Try again in a few moments (CDN may be temporarily down)

4. **Check available disk space** - Need at least 200MB in `public/` directory

5. **Try manual download with verbose output**:
   ```bash
   rm -rf public/models
   mkdir -p public/models
   npm run download:models 2>&1 | tee download.log
   cat download.log  # Check which CDN succeeded
   ```

6. **If a specific CDN works:**
   - You can edit `scripts/download_models.mjs` 
   - Move the working CDN to the top of `CDN_SOURCES` array
   - This ensures it's tried first for future downloads

## Prevention

## For Developers

If you're debugging, you can reset models in code:

```typescript
import { resetModels } from '@/lib/faceApi';

// This clears the cache and forces reload on next usage
resetModels();
```

The enhanced error messages will now tell you:
- Which model failed to load
- Why it failed (tensor mismatch, file corruption, etc.)
- What steps to fix it
