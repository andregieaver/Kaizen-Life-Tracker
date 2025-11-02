#!/bin/bash
# Add a new language to the application
# Usage: ./add-language.sh <language_code> <language_name>
# Example: ./add-language.sh es "Spanish"

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: ./add-language.sh <language_code> <language_name>"
    echo "Example: ./add-language.sh es Spanish"
    echo ""
    echo "Common language codes:"
    echo "  es - Spanish"
    echo "  fr - French"
    echo "  de - German"
    echo "  it - Italian"
    echo "  pt - Portuguese"
    echo "  sv - Swedish"
    echo "  da - Danish"
    echo "  fi - Finnish"
    exit 1
fi

LANG_CODE=$1
LANG_NAME=$2
LOCALES_DIR="/app/frontend/src/locales"
EN_FILE="$LOCALES_DIR/en.json"
NEW_FILE="$LOCALES_DIR/$LANG_CODE.json"
I18N_FILE="/app/frontend/src/i18n.js"

echo "🌍 Adding new language: $LANG_NAME ($LANG_CODE)"
echo "=============================================="
echo ""

# Check if language already exists
if [ -f "$NEW_FILE" ]; then
    echo "⚠️  Warning: $LANG_CODE.json already exists!"
    read -p "Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Step 1: Copy English file as template
echo "📄 Creating $LANG_CODE.json from English template..."
cp "$EN_FILE" "$NEW_FILE"
echo "✅ Template created"
echo ""

# Step 2: Count translation keys
key_count=$(jq -r 'paths(scalars) | join(".")' "$EN_FILE" | wc -l)
echo "📊 Translation required: $key_count keys"
echo ""

# Step 3: Check if language is already registered in i18n.js
if grep -q "import $LANG_CODE from" "$I18N_FILE"; then
    echo "✅ Language already registered in i18n.js"
else
    echo "📝 Registering language in i18n.js..."
    
    # Add import statement (after existing imports)
    sed -i "/import .* from '\.\/locales\/.*\.json';/a import $LANG_CODE from './locales/$LANG_CODE.json';" "$I18N_FILE"
    
    # Add to resources object (after existing languages)
    sed -i "/resources: {/,/}/ s/no: { translation: no },/no: { translation: no },\n    $LANG_CODE: { translation: $LANG_CODE },/" "$I18N_FILE"
    
    echo "✅ Language registered in i18n.js"
fi

echo ""
echo "=============================================="
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. TRANSLATE the file:"
echo "   File: $NEW_FILE"
echo "   Keys to translate: $key_count"
echo ""
echo "2. GUIDELINES:"
echo "   - Translate ONLY the values (right side)"
echo "   - Keep ALL keys (left side) unchanged"
echo "   - Maintain {{interpolation}} syntax"
echo "   - Preserve special characters and formatting"
echo ""
echo "3. VALIDATE translations:"
echo "   ./validate-translations.sh"
echo ""
echo "4. TEST in browser:"
echo "   - Restart frontend: sudo supervisorctl restart frontend"
echo "   - Go to Account Settings > Language"
echo "   - Select '$LANG_NAME'"
echo ""
echo "Example translation:"
echo "  EN: \"welcome\": \"Welcome back, {{name}}!\""
echo "  $LANG_CODE: \"welcome\": \"[TRANSLATE THIS], {{name}}!\""
echo ""
echo "Need help? Check: /app/frontend/scripts/translation-strategy.md"
echo ""
