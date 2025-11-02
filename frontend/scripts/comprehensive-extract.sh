#!/bin/bash
# Comprehensive string extraction for all components
# Outputs organized by component with counts

echo "🔍 COMPREHENSIVE STRING EXTRACTION REPORT"
echo "========================================"
echo ""
echo "Scanning all components for hardcoded English strings..."
echo ""

TOTAL_COMPONENTS=0
TOTAL_STRINGS=0

# Scan each component
for file in /app/frontend/src/components/*.js; do
    if [ ! -f "$file" ]; then
        continue
    fi
    
    component=$(basename "$file" .js)
    
    # Extract untranslated strings (exclude common patterns)
    strings=$(grep -n '"[A-Z][a-z][^"]*"' "$file" 2>/dev/null | \
              grep -v 't(["\x27]' | \
              grep -v 'className\|style=\|data-\|aria-\|type="\|id="\|name="\|http\|\.png\|\.jpg\|\.svg\|e\.g\.,\|alt=""')
    
    if [ ! -z "$strings" ]; then
        count=$(echo "$strings" | wc -l)
        TOTAL_COMPONENTS=$((TOTAL_COMPONENTS + 1))
        TOTAL_STRINGS=$((TOTAL_STRINGS + count))
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📄 $component.js ($count strings)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$strings" | head -20 | sed 's/^/  /'
        
        if [ $count -gt 20 ]; then
            echo "  ... and $((count - 20)) more"
        fi
        echo ""
    fi
done

echo "========================================"
echo "📊 SUMMARY"
echo "========================================"
echo "  Components with hardcoded strings: $TOTAL_COMPONENTS"
echo "  Total hardcoded strings found: $TOTAL_STRINGS"
echo ""

if [ $TOTAL_STRINGS -gt 0 ]; then
    echo "⚠️  Action Required:"
    echo "  1. Review strings above"
    echo "  2. Add to en.json and no.json"
    echo "  3. Update components to use t()"
    echo "  4. Re-run this script to verify"
else
    echo "✅ SUCCESS! No hardcoded strings found!"
fi

echo ""
