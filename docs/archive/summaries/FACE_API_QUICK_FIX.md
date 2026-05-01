# Quick Fix for Face API Issues

Getting one of these errors?
```
Unexpected token '<', "<!doctype "
tensor should have 589824 values but has 146127
Failed to load models
```

## ⚡ Fastest Fix (Windows)

Just run this in your project root:

```bash
recover-models.bat
```

Then restart `npm run dev`

---

## ⚡ Fastest Fix (Mac/Linux)

Just run this in your project root:

```bash
bash recover-models.sh
```

Then restart `npm run dev`

---

## 🔧 If Scripts Don't Work

```bash
# Step 1: Delete corrupted files
rm -rf public/models
mkdir -p public/models

# Step 2: Download fresh models (this will take 2-5 minutes)
npm run download:models

# Step 3: Restart dev server
npm run dev
```

---

## 📊 What Changed in Download Script

- ✅ **Multiple CDN sources** (tries unpkg, jsDelivr, GitHub automatically)
- ✅ **Detects HTML errors** (404/50x responses) and retries next CDN
- ✅ **Always re-downloads** (doesn't trust partial files)
- ✅ **Shows progress** (%, MB/MB)
- ✅ **Longer timeout** (120 seconds per file)
- ✅ **Verifies size** (fails if file too small)

This solves the truncation problem that was causing the tensor error.

---

## 🐛 Still Broken?

1. Check disk space: `df -h` (need 200MB free)
2. Check internet: Try `ping google.com`
3. Check the log: `npm run download:models 2>&1 | tee download.log`
4. Full troubleshooting: See `_docs/FACE_API_TROUBLESHOOTING.md`
