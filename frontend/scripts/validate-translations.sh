#!/bin/bash
# Validate translation coverage and consistency
# Usage: ./validate-translations.sh

set -e

echo "🔍 Translation Validation Report"
echo "=================================="
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed"
    echo "Install with: apt-get install jq"
    exit 1
fi

LOCALES_DIR="/app/frontend/src/locales"
EN_FILE="$LOCALES_DIR/en.json"

# Function to count keys in JSON
count_keys() {
    jq -r 'paths(scalars) | join(".")' "$1" | wc -l
}

# Function to get all keys from JSON
get_keys() {
    jq -r 'paths(scalars) | join(".")' "$1" | sort
}

echo "📊 Translation Coverage:"
echo "------------------------"

# Count English keys (master)
en_count=$(count_keys "$EN_FILE")
echo "English (master): $en_count keys"

# Check each translation file
for lang_file in "$LOCALES_DIR"/*.json; do
    if [ "$lang_file" != "$EN_FILE" ]; then
        lang=$(basename "$lang_file" .json)
        lang_count=$(count_keys "$lang_file")
        coverage=$(awk "BEGIN {printf \"%.1f\", ($lang_count/$en_count)*100}")
        
        if (( $(echo "$coverage == 100" | bc -l) )); then
            echo "✅ $lang: $lang_count keys ($coverage%)"
        elif (( $(echo "$coverage >= 80" | bc -l) )); then
            echo "🟡 $lang: $lang_count keys ($coverage%)"
        else
            echo "🔴 $lang: $lang_count keys ($coverage%)"
        fi
    fi
done

echo ""
echo "🔑 Missing Translation Keys:"
echo "----------------------------"

# Find missing keys in each language
for lang_file in "$LOCALES_DIR"/*.json; do
    if [ "$lang_file" != "$EN_FILE" ]; then
        lang=$(basename "$lang_file" .json)
        
        en_keys=$(get_keys "$EN_FILE")
        lang_keys=$(get_keys "$lang_file")
        
        missing=$(comm -23 <(echo "$en_keys") <(echo "$lang_keys"))
        
        if [ ! -z "$missing" ]; then
            echo ""
            echo "Missing in $lang.json:"
            echo "$missing" | head -10 | sed 's/^/  - /'
            
            missing_count=$(echo "$missing" | wc -l)
            if [ $missing_count -gt 10 ]; then
                echo "  ... and $((missing_count - 10)) more"
            fi
        fi
    fi
done

echo ""
echo "🔍 Scanning for Hardcoded Strings:"
echo "-----------------------------------"

# Scan components for untranslated strings
hardcoded_count=0

for file in /app/frontend/src/components/*.js; do
    if [ -f "$file" ]; then
        # Look for strings NOT using t() function
        strings=$(grep -n '"[A-Z][a-z][^"]*"' "$file" 2>/dev/null | \
                  grep -v 't(["\x27]' | \
                  grep -v 'className\|style\|data-\|aria-\|type=\|id=\|name=\|http\|e\.g\.,\|\.png\|\.jpg' | \
                  head -5)
        
        if [ ! -z "$strings" ]; then
            component=$(basename "$file")
            echo ""
            echo "⚠️  $component:"
            echo "$strings" | sed 's/^/  /'
            hardcoded_count=$((hardcoded_count + 1))
        fi
    fi
done

echo ""
echo "=================================="
echo "📋 Summary:"
echo "  - Master keys (EN): $en_count"
echo "  - Components with hardcoded strings: $hardcoded_count"

if [ $hardcoded_count -eq 0 ]; then
    echo ""
    echo "✅ All strings are translated!"
else
    echo ""
    echo "⚠️  Found hardcoded strings in $hardcoded_count components"
    echo "   Run: ./extract-strings.sh for full details"
fi

echo ""
