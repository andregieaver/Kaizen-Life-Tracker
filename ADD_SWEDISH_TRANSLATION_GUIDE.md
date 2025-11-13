# Complete Guide: Adding Swedish Translation to TrainSmart

## Overview
This guide provides the most efficient and reliable approach to add Swedish translation with all 2,020 translation keys.

## Current State
- ✅ English locale: 2,020 keys across 43 sections
- ✅ Norwegian locale: 2,020 keys (fully translated)
- 🎯 Target: Swedish locale with 2,020 keys

---

## RECOMMENDED APPROACH: AI-Assisted Translation

### Why This Approach?
- ✅ **Fast**: Complete translation in 15-30 minutes
- ✅ **Accurate**: Context-aware translations
- ✅ **Cost-effective**: ~$2-5 using GPT-4 API
- ✅ **Maintains structure**: JSON structure preserved
- ✅ **Consistent**: Same terminology throughout

### Step-by-Step Process

#### OPTION A: Using ChatGPT API (RECOMMENDED)

**Prerequisites:**
- OpenAI API key
- Python installed

**Step 1: Create Translation Script**
```bash
cd /app
```

Create `translate_to_swedish.py`:
```python
import json
import os
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def translate_batch(text_batch, source_lang="English", target_lang="Swedish"):
    """Translate a batch of text using GPT-4"""
    prompt = f"""Translate the following JSON values from {source_lang} to {target_lang}.
Keep all JSON keys unchanged. Only translate the string values.
Maintain professional, consistent terminology throughout.
Context: This is a fitness/health tracking application called TrainSmart.

JSON to translate:
{json.dumps(text_batch, indent=2)}

Return ONLY valid JSON with the same structure, with values translated to {target_lang}."""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a professional translator specializing in software localization. You maintain technical accuracy while providing natural translations."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    translated_json = json.loads(response.choices[0].message.content)
    return translated_json

def translate_locale_file(input_file, output_file, chunk_size=50):
    """Translate entire locale file in chunks"""
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    translated_data = {}
    sections = list(data.keys())
    
    print(f"Translating {len(sections)} sections...")
    
    for i, section in enumerate(sections, 1):
        print(f"[{i}/{len(sections)}] Translating section: {section}")
        translated_data[section] = translate_batch(data[section])
        
        # Save progress periodically
        if i % 5 == 0:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            print(f"  ✓ Progress saved ({i}/{len(sections)} sections)")
    
    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translated_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Translation complete! Saved to {output_file}")
    return translated_data

if __name__ == "__main__":
    translate_locale_file(
        'frontend/src/locales/en.json',
        'frontend/src/locales/sv.json'
    )
```

**Step 2: Run Translation**
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run translation (takes ~15-20 minutes)
python3 translate_to_swedish.py
```

---

#### OPTION B: Using DeepL API (Alternative)

**Prerequisites:**
- DeepL API key (free tier available)

```python
import json
import deepl

def translate_with_deepl(input_file, output_file, api_key):
    translator = deepl.Translator(api_key)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    def translate_recursive(obj):
        if isinstance(obj, dict):
            return {k: translate_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, str):
            result = translator.translate_text(obj, target_lang="SV")
            return result.text
        else:
            return obj
    
    translated = translate_recursive(data)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translated, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Translation complete! Saved to {output_file}")

# Usage
translate_with_deepl(
    'frontend/src/locales/en.json',
    'frontend/src/locales/sv.json',
    'your-deepl-api-key'
)
```

---

#### OPTION C: Manual Translation with Assistance

If you prefer not to use APIs, I can help translate sections:

1. **Split the file into chunks**
2. **Provide each chunk for translation**
3. **I translate each section**
4. **Combine all sections**

This would take multiple rounds but ensures human review.

---

## Step 3: Integrate Swedish into the Application

### 3.1 Update i18n Configuration

Edit `/app/frontend/src/i18n.js`:

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import noTranslations from './locales/no.json';
import svTranslations from './locales/sv.json'; // ADD THIS

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      no: { translation: noTranslations },
      sv: { translation: svTranslations }, // ADD THIS
    },
    lng: localStorage.getItem('language') || 'no',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

### 3.2 Update Language Switcher

Find the language selector component (usually in header/settings) and add Swedish:

```javascript
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' }, // ADD THIS
];
```

---

## Step 4: Validation & Testing

### 4.1 Validate JSON Structure
```bash
cd /app
python3 << 'EOF'
import json

# Validate sv.json
with open('frontend/src/locales/sv.json', 'r') as f:
    sv_data = json.load(f)

with open('frontend/src/locales/en.json', 'r') as f:
    en_data = json.load(f)

# Check all keys match
def get_all_keys(obj, prefix=''):
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(get_all_keys(v, full_key))
            else:
                keys.add(full_key)
    return keys

en_keys = get_all_keys(en_data)
sv_keys = get_all_keys(sv_data)

print(f"English keys: {len(en_keys)}")
print(f"Swedish keys: {len(sv_keys)}")
print(f"Missing in Swedish: {len(en_keys - sv_keys)}")
print(f"Extra in Swedish: {len(sv_keys - en_keys)}")

if en_keys == sv_keys:
    print("\n✅ All keys match perfectly!")
else:
    print("\n❌ Key mismatch found!")
    if en_keys - sv_keys:
        print("Missing keys:", list(en_keys - sv_keys)[:10])
EOF
```

### 4.2 Test in Application
```bash
# Restart frontend
sudo supervisorctl restart frontend

# Test Swedish language:
# 1. Open application in browser
# 2. Change language to Svenska (Swedish)
# 3. Navigate through key pages:
#    - Dashboard
#    - Account Settings
#    - System Settings
#    - Community
#    - Orders/Subscriptions
# 4. Verify all text displays in Swedish
```

---

## Expected Results

### Translation Quality Metrics
- ✅ 2,020 keys translated
- ✅ Consistent terminology
- ✅ Professional fitness/health vocabulary
- ✅ Proper Swedish grammar
- ✅ Technical terms appropriately localized

### Common Swedish Translations
| English | Swedish |
|---------|---------|
| Settings | Inställningar |
| Account | Konto |
| Dashboard | Instrumentpanel |
| Save | Spara |
| Cancel | Avbryt |
| Delete | Ta bort |
| Edit | Redigera |
| Profile | Profil |
| Subscription | Prenumeration |
| Community | Gemenskap |
| Workout | Träningspass |
| Nutrition | Näring |
| Statistics | Statistik |
| Loading... | Laddar... |

---

## Cost Estimation

### Using GPT-4 API
- Input tokens: ~70,000 tokens
- Output tokens: ~70,000 tokens
- Total cost: ~$2-4 USD

### Using DeepL API
- Free tier: 500,000 characters/month
- Pro tier: $5.49/month for 1M characters
- Total cost: FREE (within limits) or ~$5

### Using Professional Translator
- Rate: $0.10-0.25 per word
- Word count: ~8,000 words
- Total cost: $800-2,000 USD

**Recommendation: Use GPT-4 API for best balance of cost, speed, and quality**

---

## Troubleshooting

### Issue: JSON Syntax Error
**Solution:** Validate JSON at jsonlint.com or use:
```bash
python3 -m json.tool frontend/src/locales/sv.json
```

### Issue: Missing Keys
**Solution:** Compare with English file:
```bash
diff <(jq -S 'keys' frontend/src/locales/en.json) <(jq -S 'keys' frontend/src/locales/sv.json)
```

### Issue: Special Characters Display Wrong
**Solution:** Ensure file is saved with UTF-8 encoding:
```bash
file -I frontend/src/locales/sv.json
# Should show: charset=utf-8
```

---

## Maintenance

### Adding New Keys in the Future
When adding new translation keys:

1. Add to `en.json` first
2. Copy key structure to `no.json` and `sv.json`
3. Translate the new values
4. Test in all three languages

### Automated Sync Script
Create `sync_translations.py` to detect missing keys:
```python
import json

def find_missing_keys(reference_file, target_file):
    with open(reference_file) as f:
        ref_keys = set(get_all_keys(json.load(f)))
    with open(target_file) as f:
        target_keys = set(get_all_keys(json.load(f)))
    
    missing = ref_keys - target_keys
    if missing:
        print(f"Missing keys in {target_file}:")
        for key in missing:
            print(f"  - {key}")
    else:
        print(f"✅ {target_file} is up to date!")

# Run regularly
find_missing_keys('en.json', 'sv.json')
```

---

## Summary

**Fastest Path to Swedish Translation:**

1. ✅ Use provided Python script with OpenAI API
2. ✅ Run translation (15-20 minutes)
3. ✅ Validate JSON structure
4. ✅ Update i18n.js to include Swedish
5. ✅ Add Swedish to language switcher
6. ✅ Test application
7. ✅ Deploy!

**Total Time: 30-45 minutes**
**Total Cost: ~$3-5**

---

## Need Help?

If you need assistance with any step, I can:
1. Generate the translation script customized for your setup
2. Translate sections manually if API approach isn't suitable
3. Help debug any integration issues
4. Validate the final Swedish translation file

Let me know which approach you'd like to proceed with!
