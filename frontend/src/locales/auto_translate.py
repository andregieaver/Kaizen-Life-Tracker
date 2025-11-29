#!/usr/bin/env python3
"""
Auto-translate script to fix mixed-language translations
Uses Google Translate via deep-translator library (free, no API key needed)
"""

import json
import time
from pathlib import Path
from deep_translator import GoogleTranslator

# Language code mapping
LANG_MAP = {
    'de': 'de',  # German
    'fr': 'fr',  # French
    'es': 'es',  # Spanish
    'it': 'it',  # Italian
    'da': 'da',  # Danish
    'sv': 'sv',  # Swedish
    'no': 'no',  # Norwegian
    'ja': 'ja',  # Japanese
    'zh': 'zh-CN'  # Chinese Simplified
}

def translate_text(text, target_lang):
    """Translate text to target language using Google Translate"""
    try:
        translator = GoogleTranslator(source='en', target=target_lang)
        result = translator.translate(text)
        return result
    except Exception as e:
        print(f"      ⚠️  Translation error: {e}")
        return text  # Return original on error

def translate_dict(data, target_lang, path=""):
    """Recursively translate dictionary values"""
    translated = {}
    
    for key, value in data.items():
        current_path = f"{path}.{key}" if path else key
        
        if isinstance(value, dict):
            translated[key] = translate_dict(value, target_lang, current_path)
        elif isinstance(value, list):
            translated[key] = [
                translate_dict(item, target_lang, f"{current_path}[{i}]") 
                if isinstance(item, dict) else item
                for i, item in enumerate(value)
            ]
        elif isinstance(value, str):
            # Translate string values
            # Skip if already in target language (basic check)
            translated[key] = translate_text(value, target_lang)
            time.sleep(0.1)  # Rate limiting
        else:
            translated[key] = value
    
    return translated

def should_translate_lang(lang_code):
    """Check if language needs translation based on scan results"""
    # Languages that have mixed content
    needs_translation = ['de', 'fr', 'es', 'it', 'da', 'ja', 'zh']
    return lang_code in needs_translation

def main():
    """Main translation function"""
    locale_dir = Path(__file__).parent
    
    # Load English source
    print("📖 Loading English source file...")
    with open(locale_dir / 'en.json', 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    print(f"✅ Loaded {len(str(en_data))} characters from en.json\n")
    
    # Process each language
    for lang_code, target_lang in LANG_MAP.items():
        if not should_translate_lang(lang_code):
            print(f"⏭️  Skipping {lang_code.upper()} (no translation needed)")
            continue
        
        file_path = locale_dir / f"{lang_code}.json"
        backup_path = locale_dir / f"{lang_code}.json.backup"
        
        print(f"\n{'='*60}")
        print(f"🌍 Translating to {lang_code.upper()}")
        print(f"{'='*60}")
        
        # Backup existing file
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=2)
            print(f"💾 Backup created: {backup_path.name}")
        
        # Translate
        print(f"🔄 Translating from English...")
        try:
            translated_data = translate_dict(en_data, target_lang)
            
            # Save translated file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Translation complete: {file_path.name}")
            print(f"   File size: {file_path.stat().st_size} bytes")
        
        except Exception as e:
            print(f"❌ Error translating {lang_code}: {e}")
            # Restore from backup
            if backup_path.exists():
                with open(backup_path, 'r', encoding='utf-8') as f:
                    backup_data = json.load(f)
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(backup_data, f, ensure_ascii=False, indent=2)
                print(f"↩️  Restored from backup")
    
    print(f"\n\n{'='*60}")
    print(f"🎉 Translation process complete!")
    print(f"{'='*60}")
    print(f"\n⚠️  NOTE: Backups saved with .backup extension")
    print(f"   Review translations and restart frontend to apply changes")

if __name__ == "__main__":
    main()
