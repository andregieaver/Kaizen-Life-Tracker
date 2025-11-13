#!/usr/bin/env python3
"""
Swedish Integration Helper
Automatically updates i18n.js to include Swedish
"""

import os
import re

def integrate_swedish():
    """Add Swedish to i18n.js configuration"""
    
    print("=" * 60)
    print("🔧 Swedish Integration Helper")
    print("=" * 60)
    
    i18n_path = 'frontend/src/i18n.js'
    
    # Check if file exists
    if not os.path.exists(i18n_path):
        print(f"\n❌ Error: {i18n_path} not found!")
        print("Please ensure you're in the /app directory")
        return False
    
    print(f"\n📖 Reading {i18n_path}...")
    
    with open(i18n_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already integrated
    if 'svTranslations' in content or "from './locales/sv.json'" in content:
        print("⚠️  Swedish appears to already be integrated!")
        print("Check i18n.js manually if you're having issues.")
        return True
    
    print("✏️  Adding Swedish import and configuration...")
    
    # Add import for Swedish
    import_pattern = r"(import noTranslations from ['\"]\.\/locales\/no\.json['\"];?)"
    import_replacement = r"\1\nimport svTranslations from './locales/sv.json';"
    
    if re.search(import_pattern, content):
        content = re.sub(import_pattern, import_replacement, content)
        print("   ✅ Added Swedish import")
    else:
        print("   ⚠️  Could not find Norwegian import to add after")
        print("   Please add this line manually after the Norwegian import:")
        print("   import svTranslations from './locales/sv.json';")
    
    # Add Swedish to resources
    resources_pattern = r"(no: \{ translation: noTranslations \},?)"
    resources_replacement = r"\1\n      sv: { translation: svTranslations },"
    
    if re.search(resources_pattern, content):
        content = re.sub(resources_pattern, resources_replacement, content)
        print("   ✅ Added Swedish to resources")
    else:
        print("   ⚠️  Could not find resources section")
        print("   Please add this line manually in the resources section:")
        print("   sv: { translation: svTranslations },")
    
    # Write back
    print(f"\n💾 Saving changes to {i18n_path}...")
    with open(i18n_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ i18n.js updated successfully!")
    
    # Show what was added
    print("\n📝 Changes made:")
    print("   1. Added: import svTranslations from './locales/sv.json';")
    print("   2. Added: sv: { translation: svTranslations },")
    
    print("\n✨ Next steps:")
    print("   1. Add Swedish to your language switcher component")
    print("   2. Restart frontend: sudo supervisorctl restart frontend")
    print("   3. Test Swedish in the application")
    
    return True

def show_language_switcher_code():
    """Show example code for language switcher"""
    print("\n" + "=" * 60)
    print("📋 Language Switcher Code Example")
    print("=" * 60)
    print("\nAdd this to your language selector component:")
    print("""
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
];

// Then use it in your dropdown/buttons
{languages.map(lang => (
  <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}>
    {lang.flag} {lang.name}
  </button>
))}
""")

if __name__ == "__main__":
    try:
        if integrate_swedish():
            show_language_switcher_code()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease update i18n.js manually:")
        print("1. Import: import svTranslations from './locales/sv.json';")
        print("2. Add to resources: sv: { translation: svTranslations },")
