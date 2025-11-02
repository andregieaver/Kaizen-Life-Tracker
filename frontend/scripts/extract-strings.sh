#!/bin/bash
# Extract all hardcoded English strings from components
# Output: strings that need translation

echo "=== SCANNING FOR UNTRANSLATED STRINGS ==="
echo ""

# Function to extract strings from a file
extract_strings() {
    local file=$1
    local component=$(basename "$file" .js)
    
    # Find strings that are NOT using t() function
    # Exclude: className, style, data-, aria-, type, id, name, http, placeholder with examples
    strings=$(grep -o '"[A-Z][^"]*"' "$file" 2>/dev/null | \
              grep -v 'className\|style\|data-\|aria-\|type=\|id=\|name=\|http\|e\.g\.,\|\.png\|\.jpg\|\.svg' | \
              sort -u)
    
    if [ ! -z "$strings" ]; then
        echo "📄 $component"
        echo "$strings" | sed 's/^/  /'
        echo ""
    fi
}

# Scan all component files
echo "🔍 Scanning components..."
for file in /app/frontend/src/components/*.js; do
    if [ -f "$file" ]; then
        extract_strings "$file"
    fi
done

echo "=== SCAN COMPLETE ==="
echo ""
echo "💡 Next steps:"
echo "1. Review extracted strings"
echo "2. Add to en.json with proper keys"
echo "3. Translate to no.json"
echo "4. Update components to use t() function"
