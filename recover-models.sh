#!/bin/bash
# Clean and download face-api models

echo ""
echo "============================================"
echo "Face API Model Recovery Script"
echo "============================================"
echo ""

# Step 1: Delete old models
echo "Step 1: Removing corrupted model files..."
if [ -d "public/models" ]; then
    rm -rf public/models
    echo "✓ Deleted public/models"
else
    echo "(Directory doesn't exist, creating new one)"
fi

# Create directory
mkdir -p public/models
echo "✓ Created public/models directory"
echo ""

# Step 2: Download fresh models
echo "Step 2: Downloading fresh models..."
echo "(This may take 2-5 minutes, please be patient)"
echo ""
npm run download:models

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ Download failed!"
    echo ""
    echo "Troubleshooting:"
    echo "- Check your internet connection"
    echo "- Try again in a few moments"
    echo "- If it keeps failing, the CDN may be temporarily down"
    echo ""
    exit 1
fi

echo ""
echo "============================================"
echo "✓ Models downloaded successfully!"
echo "============================================"
echo ""
echo "Step 3: Now restart your dev server"
echo "   Press Ctrl+C to stop the current server"
echo "   Then run: npm run dev"
echo ""
