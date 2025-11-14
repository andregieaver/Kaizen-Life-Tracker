#!/bin/bash
# Bundle Analysis Script

echo "========================================="
echo "TrainSmart Bundle Analysis"
echo "========================================="
echo ""

cd /app/frontend

# Check current bundle size
echo "1. Current Development Build Status..."
du -sh build 2>/dev/null || echo "No build found yet"
echo ""

# Create production build with stats
echo "2. Creating production build with source map analysis..."
GENERATE_SOURCEMAP=true npm run build -- --stats 2>&1 | tail -20

echo ""
echo "3. Bundle size breakdown:"
if [ -d "build/static/js" ]; then
    ls -lh build/static/js/*.js | awk '{print $5, $9}' | sort -rh | head -10
else
    echo "Build directory not found"
fi

echo ""
echo "4. Total bundle size:"
du -sh build 2>/dev/null || echo "Build not complete"

echo ""
echo "========================================="
echo "Analysis complete!"
echo "========================================="
