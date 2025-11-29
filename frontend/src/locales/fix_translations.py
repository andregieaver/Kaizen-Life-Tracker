#!/usr/bin/env python3
"""
Translation fixer script
Identifies and reports mixed-language content in translation files
"""

import json
import re
from pathlib import Path

def has_english_content(text):
    """Check if text contains English words (basic heuristic)"""
    if not isinstance(text, str):
        return False
    
    # Common English words that shouldn't appear in translations
    english_patterns = [
        r'\bWelcome\b', r'\bHello\b', r'\bBack\b', r'\bNext\b', r'\bSettings\b',
        r'\bTraining\b', r'\bStatistics\b', r'\bView\b', r'\bSave\b', r'\bCancel\b',
        r'\bDelete\b', r'\bEdit\b', r'\bAdd\b', r'\bRemove\b', r'\bUpdate\b',
        r'\bLoading\b', r'\bError\b', r'\bSuccess\b', r'\bWarning\b'
    ]
    
    for pattern in english_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

def has_french_content(text):
    """Check if text contains French words"""
    if not isinstance(text, str):
        return False
    
    french_patterns = [
        r'\bBon retour\b', r'\bObjectif\b', r'\bEntraînement\b', r'\bStatistiques\b',
        r'\bVoir les\b', r'\bPréparation\b', r'\bActivité\b', r'\bMerci\b',
        r'\bAucun\b', r'\bMétriques\b'
    ]
    
    for pattern in french_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

def scan_translations(obj, path="", issues=None, check_lang="de"):
    """Recursively scan translation object for mixed content"""
    if issues is None:
        issues = []
    
    if isinstance(obj, dict):
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            scan_translations(value, current_path, issues, check_lang)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            scan_translations(item, f"{path}[{i}]", issues, check_lang)
    elif isinstance(obj, str):
        # Check for English in non-English files
        if check_lang != "en" and has_english_content(obj):
            issues.append({
                'path': path,
                'value': obj,
                'type': 'english',
                'file': check_lang
            })
        # Check for French in German files
        if check_lang == "de" and has_french_content(obj):
            issues.append({
                'path': path,
                'value': obj,
                'type': 'french',
                'file': check_lang
            })
    
    return issues

def main():
    """Main function to scan all translation files"""
    locale_dir = Path(__file__).parent
    
    # Languages to check (excluding English which is the source)
    languages = ['de', 'fr', 'es', 'it', 'da', 'sv', 'no', 'ja', 'zh']
    
    all_issues = {}
    
    for lang in languages:
        file_path = locale_dir / f"{lang}.json"
        if not file_path.exists():
            print(f"⚠️  {lang}.json not found")
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            issues = scan_translations(data, check_lang=lang)
            
            if issues:
                all_issues[lang] = issues
                print(f"\n{'='*60}")
                print(f"🔍 {lang.upper()}: Found {len(issues)} mixed-language entries")
                print(f"{'='*60}")
                
                # Group by type
                english_count = sum(1 for i in issues if i['type'] == 'english')
                french_count = sum(1 for i in issues if i['type'] == 'french')
                
                if english_count:
                    print(f"  ❌ English text: {english_count} entries")
                if french_count:
                    print(f"  ❌ French text: {french_count} entries")
                
                # Show first 5 examples
                print(f"\n  First 5 examples:")
                for issue in issues[:5]:
                    type_emoji = "🇬🇧" if issue['type'] == 'english' else "🇫🇷"
                    print(f"    {type_emoji} {issue['path']}")
                    print(f"       → {issue['value'][:80]}")
            else:
                print(f"✅ {lang.upper()}: No mixed-language content found")
        
        except Exception as e:
            print(f"❌ Error processing {lang}.json: {e}")
    
    # Summary
    print(f"\n\n{'='*60}")
    print(f"📊 SUMMARY")
    print(f"{'='*60}")
    total_issues = sum(len(issues) for issues in all_issues.values())
    print(f"Total mixed-language entries found: {total_issues}")
    print(f"Languages affected: {len(all_issues)}/{len(languages)}")
    
    if all_issues:
        print(f"\n⚠️  RECOMMENDATION:")
        print(f"   These translation files need to be regenerated from en.json")
        print(f"   using a proper translation service (DeepL, Google Translate, etc.)")

if __name__ == "__main__":
    main()
