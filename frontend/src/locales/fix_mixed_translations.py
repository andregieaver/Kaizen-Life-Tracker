#!/usr/bin/env python3
"""
Smart translation fixer - only translates problematic entries
Much faster than translating the entire file
"""

import json
import time
import re
from pathlib import Path
from deep_translator import GoogleTranslator

LANG_MAP = {
    'de': 'de',
    'fr': 'fr', 
    'es': 'es',
    'it': 'it',
    'da': 'da',
    'ja': 'ja',
    'zh': 'zh-CN'
}

def has_english_content(text):
    """Check if text contains English words"""
    if not isinstance(text, str):
        return False
    english_patterns = [
        r'\bWelcome\b', r'\bHello\b', r'\bBack\b', r'\bNext\b', r'\bSettings\b',
        r'\bTraining\b', r'\bStatistics\b', r'\bView\b', r'\bSave\b', r'\bCancel\b',
        r'\bDelete\b', r'\bEdit\b', r'\bAdd\b', r'\bRemove\b', r'\bUpdate\b',
        r'\bLoading\b', r'\bError\b', r'\bSuccess\b', r'\bWarning\b', r'\bGet Started\b',
        r'\bLet\'s\b', r'\bStarted\b'
    ]
    return any(re.search(p, text, re.IGNORECASE) for p in english_patterns)

def has_french_content(text):
    """Check if text contains French words"""
    if not isinstance(text, str):
        return False
    french_patterns = [
        r'\bBon retour\b', r'\bObjectif\b', r'\bEntraînement\b', r'\bStatistiques\b',
        r'\bVoir les\b', r'\bPréparation\b', r'\bActivité\b', r'\bMerci\b',
        r'\bAucun\b', r'\bMétriques\b', r'\bEntrez\b'
    ]
    return any(re.search(p, text, re.IGNORECASE) for p in french_patterns)

def translate_text(text, target_lang):
    """Translate text using Google Translate"""
    try:
        translator = GoogleTranslator(source='en', target=target_lang)
        result = translator.translate(text)
        time.sleep(0.15)  # Rate limiting
        return result
    except Exception as e:
        print(f"        ⚠️  Error: {e}")
        return text

def fix_translations(data, en_data, target_lang, path="", fixes=None):
    """Recursively find and fix problematic translations"""
    if fixes is None:
        fixes = []
    
    if isinstance(data, dict) and isinstance(en_data, dict):
        for key in data.keys():
            current_path = f"{path}.{key}" if path else key
            
            if key in en_data:
                if isinstance(data[key], dict) and isinstance(en_data[key], dict):
                    fix_translations(data[key], en_data[key], target_lang, current_path, fixes)
                elif isinstance(data[key], str) and isinstance(en_data[key], str):
                    # Check if this entry needs translation
                    needs_fix = False
                    if target_lang == 'de':
                        needs_fix = has_english_content(data[key]) or has_french_content(data[key])
                    else:
                        needs_fix = has_english_content(data[key])
                    
                    if needs_fix:
                        # Translate from English source
                        new_value = translate_text(en_data[key], target_lang)
                        data[key] = new_value
                        fixes.append((current_path, en_data[key][:50], new_value[:50]))
    
    return fixes

def main():
    """Main function"""
    locale_dir = Path(__file__).parent
    
    print("📖 Loading English source...")
    with open(locale_dir / 'en.json', 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    # Languages that need fixing
    langs_to_fix = ['de', 'fr', 'es', 'it', 'da', 'ja', 'zh']
    
    for lang_code in langs_to_fix:
        target_lang = LANG_MAP[lang_code]
        file_path = locale_dir / f"{lang_code}.json"
        backup_path = locale_dir / f"{lang_code}.json.backup"
        
        print(f"\n{'='*60}")
        print(f"🔧 Fixing {lang_code.upper()}")
        print(f"{'='*60}")
        
        # Load current file
        with open(file_path, 'r', encoding='utf-8') as f:
            lang_data = json.load(f)
        
        # Backup
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(lang_data, f, ensure_ascii=False, indent=2)
        print(f"💾 Backup: {backup_path.name}")
        
        # Fix translations
        print(f"🔄 Finding and fixing problematic entries...")
        fixes = fix_translations(lang_data, en_data, target_lang)
        
        if fixes:
            # Save fixed file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(lang_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Fixed {len(fixes)} entries")
            print(f"\n   First 3 fixes:")
            for path, orig, new in fixes[:3]:
                print(f"     • {path}")
                print(f"       {orig}... → {new}...")
        else:
            print(f"✅ No problematic entries found")
    
    print(f"\n\n{'='*60}")
    print(f"🎉 All translations fixed!")
    print(f"{'='*60}")
    print(f"\nRestart frontend to apply changes: sudo supervisorctl restart frontend")

if __name__ == "__main__":
    main()
