#!/usr/bin/env python3
"""
Swedish Translation Validator
Validates the Swedish locale file for completeness and correctness
"""

import json
import sys

def get_all_keys(obj, prefix=''):
    """Recursively extract all keys from nested JSON"""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(get_all_keys(v, full_key))
            else:
                keys.add(full_key)
    return keys

def count_keys(obj):
    """Count total keys in nested JSON"""
    if isinstance(obj, dict):
        return sum(count_keys(v) if isinstance(v, dict) else 1 for v in obj.values())
    return 1

def validate_translation():
    """Validate Swedish translation against English original"""
    
    print("=" * 60)
    print("🔍 Swedish Translation Validator")
    print("=" * 60)
    
    # Load files
    print("\n📖 Loading locale files...")
    
    try:
        with open('frontend/src/locales/en.json', 'r', encoding='utf-8') as f:
            en_data = json.load(f)
        print("✅ English locale loaded")
    except Exception as e:
        print(f"❌ Failed to load English locale: {e}")
        return False
    
    try:
        with open('frontend/src/locales/sv.json', 'r', encoding='utf-8') as f:
            sv_data = json.load(f)
        print("✅ Swedish locale loaded")
    except Exception as e:
        print(f"❌ Failed to load Swedish locale: {e}")
        return False
    
    # Extract all keys
    print("\n🔑 Analyzing translation keys...")
    en_keys = get_all_keys(en_data)
    sv_keys = get_all_keys(sv_data)
    
    en_sections = set(en_data.keys())
    sv_sections = set(sv_data.keys())
    
    # Count total keys
    en_total = count_keys(en_data)
    sv_total = count_keys(sv_data)
    
    print(f"   English: {len(en_sections)} sections, {en_total} keys")
    print(f"   Swedish: {len(sv_sections)} sections, {sv_total} keys")
    
    # Check for issues
    issues_found = False
    
    # 1. Check sections
    print("\n📋 Section Comparison:")
    missing_sections = en_sections - sv_sections
    extra_sections = sv_sections - en_sections
    
    if missing_sections:
        issues_found = True
        print(f"   ❌ Missing sections in Swedish: {len(missing_sections)}")
        for section in sorted(missing_sections)[:5]:
            print(f"      - {section}")
        if len(missing_sections) > 5:
            print(f"      ... and {len(missing_sections) - 5} more")
    
    if extra_sections:
        print(f"   ⚠️  Extra sections in Swedish: {len(extra_sections)}")
        for section in sorted(extra_sections)[:5]:
            print(f"      - {section}")
    
    if not missing_sections and not extra_sections:
        print("   ✅ All sections match perfectly!")
    
    # 2. Check keys
    print("\n🔑 Key Comparison:")
    missing_keys = en_keys - sv_keys
    extra_keys = sv_keys - en_keys
    
    if missing_keys:
        issues_found = True
        print(f"   ❌ Missing keys in Swedish: {len(missing_keys)}")
        for key in sorted(missing_keys)[:10]:
            print(f"      - {key}")
        if len(missing_keys) > 10:
            print(f"      ... and {len(missing_keys) - 10} more")
    
    if extra_keys:
        print(f"   ⚠️  Extra keys in Swedish: {len(extra_keys)}")
        for key in sorted(extra_keys)[:10]:
            print(f"      - {key}")
    
    if not missing_keys and not extra_keys:
        print("   ✅ All keys match perfectly!")
    
    # 3. Check for untranslated values (still in English)
    print("\n🔤 Translation Quality Check:")
    
    def find_untranslated(en_obj, sv_obj, path=''):
        """Find values that might not be translated"""
        untranslated = []
        if isinstance(en_obj, dict) and isinstance(sv_obj, dict):
            for key in en_obj:
                if key in sv_obj:
                    current_path = f"{path}.{key}" if path else key
                    if isinstance(en_obj[key], dict):
                        untranslated.extend(find_untranslated(en_obj[key], sv_obj[key], current_path))
                    elif isinstance(en_obj[key], str) and isinstance(sv_obj[key], str):
                        # Check if values are identical (might indicate missing translation)
                        if en_obj[key] == sv_obj[key] and len(en_obj[key]) > 3:
                            # Skip technical terms and proper nouns
                            if not any(term in en_obj[key].lower() for term in ['api', 'gtm', 'oauth', 'url', 'http', 'id']):
                                untranslated.append((current_path, en_obj[key]))
        return untranslated
    
    untranslated = find_untranslated(en_data, sv_data)
    
    if untranslated:
        print(f"   ⚠️  Potentially untranslated values: {len(untranslated)}")
        for path, value in untranslated[:5]:
            print(f"      - {path}: '{value[:50]}'")
        if len(untranslated) > 5:
            print(f"      ... and {len(untranslated) - 5} more")
        print("   💡 Note: Some identical values may be technical terms (API, GTM, etc.)")
    else:
        print("   ✅ All values appear to be translated!")
    
    # 4. Check JSON structure
    print("\n📊 Structure Validation:")
    
    def check_structure(en_obj, sv_obj, path=''):
        """Check if structure matches"""
        issues = []
        if type(en_obj) != type(sv_obj):
            issues.append(f"{path}: Type mismatch (EN: {type(en_obj).__name__}, SV: {type(sv_obj).__name__})")
        elif isinstance(en_obj, dict):
            for key in en_obj:
                current_path = f"{path}.{key}" if path else key
                if key not in sv_obj:
                    issues.append(f"{current_path}: Missing in Swedish")
                else:
                    issues.extend(check_structure(en_obj[key], sv_obj[key], current_path))
        return issues
    
    structure_issues = check_structure(en_data, sv_data)
    
    if structure_issues:
        issues_found = True
        print(f"   ❌ Structure issues found: {len(structure_issues)}")
        for issue in structure_issues[:10]:
            print(f"      - {issue}")
        if len(structure_issues) > 10:
            print(f"      ... and {len(structure_issues) - 10} more")
    else:
        print("   ✅ Structure matches perfectly!")
    
    # 5. File size check
    print("\n💾 File Size:")
    import os
    en_size = os.path.getsize('frontend/src/locales/en.json') / 1024
    sv_size = os.path.getsize('frontend/src/locales/sv.json') / 1024
    print(f"   English: {en_size:.1f} KB")
    print(f"   Swedish: {sv_size:.1f} KB")
    
    size_diff = abs(sv_size - en_size) / en_size * 100
    if size_diff > 30:
        print(f"   ⚠️  Size difference: {size_diff:.1f}% (might indicate issues)")
    else:
        print(f"   ✅ Size difference: {size_diff:.1f}% (normal)")
    
    # Final verdict
    print("\n" + "=" * 60)
    if issues_found:
        print("⚠️  Validation completed with issues")
        print("=" * 60)
        print("\n⚡ Issues found that need attention:")
        if missing_keys:
            print(f"   • {len(missing_keys)} missing translation keys")
        if missing_sections:
            print(f"   • {len(missing_sections)} missing sections")
        if structure_issues:
            print(f"   • {len(structure_issues)} structure mismatches")
        print("\n💡 Recommendation: Review and fix issues before deployment")
        return False
    else:
        print("✅ Validation Successful!")
        print("=" * 60)
        print("\n🎉 Swedish translation is complete and valid!")
        print(f"   • {len(sv_sections)} sections translated")
        print(f"   • {sv_total} keys translated")
        print(f"   • Structure matches English locale")
        print("\n✨ Ready for integration:")
        print("   1. Update frontend/src/i18n.js")
        print("   2. Add Swedish to language switcher")
        print("   3. Test in application")
        return True

if __name__ == "__main__":
    try:
        success = validate_translation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Validation error: {e}")
        sys.exit(1)
