# Swedish Translation - Quick Start Guide

## Ready to Execute! 🚀

All scripts are created and ready to use. Follow these steps:

---

## Step 1: Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in (or create account)
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**Don't have an account?** OpenAI gives $5 free credit for new accounts!

---

## Step 2: Set Your API Key

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

**To verify it's set:**
```bash
echo $OPENAI_API_KEY
```

---

## Step 3: Install OpenAI Python Package

```bash
pip install openai
```

---

## Step 4: Run the Translation

```bash
cd /app
python3 translate_to_swedish.py
```

**What happens:**
- ✅ Reads `frontend/src/locales/en.json`
- ✅ Translates all 2,020 keys to Swedish
- ✅ Saves to `frontend/src/locales/sv.json`
- ✅ Shows progress in real-time
- ✅ Auto-saves every 5 sections
- ⏱️ Takes 15-25 minutes

**Console output will look like:**
```
============================================================
🇸🇪 Swedish Translation Script - TrainSmart Application
============================================================

[1/43] Translating: auth                 ✅
[2/43] Translating: account              ✅
[3/43] Translating: dashboard            ✅
...
```

**If interrupted:** Just run again - it resumes from where it stopped!

---

## Step 5: Validate the Translation

```bash
python3 validate_swedish.py
```

**This checks:**
- ✅ All sections present
- ✅ All keys translated
- ✅ Structure matches English
- ✅ No missing translations
- ✅ File integrity

**Expected output:**
```
✅ Validation Successful!
🎉 Swedish translation is complete and valid!
```

---

## Step 6: Integrate Swedish into Application

### 6.1 Update i18n Configuration

Find and edit: `frontend/src/i18n.js`

**Add these lines:**

```javascript
import svTranslations from './locales/sv.json'; // ADD THIS LINE

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      no: { translation: noTranslations },
      sv: { translation: svTranslations }, // ADD THIS LINE
    },
    // ... rest of config
  });
```

### 6.2 Add Swedish to Language Switcher

Find your language selector component (usually in header or settings).

**Add Swedish option:**

```javascript
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' }, // ADD THIS
];
```

---

## Step 7: Test the Swedish Translation

```bash
# Restart frontend (hot reload should work, but just in case)
sudo supervisorctl restart frontend
```

**Open application in browser:**
1. Change language to "Svenska" (Swedish)
2. Navigate through pages:
   - Dashboard
   - Account Settings
   - System Settings
   - Community
   - Orders
3. Verify all text is in Swedish

---

## Troubleshooting

### Problem: "OPENAI_API_KEY not set"
**Solution:**
```bash
export OPENAI_API_KEY="your-key-here"
# Verify:
echo $OPENAI_API_KEY
```

### Problem: "pip: command not found"
**Solution:**
```bash
# Try pip3 instead
pip3 install openai
```

### Problem: "ModuleNotFoundError: No module named 'openai'"
**Solution:**
```bash
pip3 install --upgrade openai
```

### Problem: Translation stops midway
**Solution:**
- Just run the script again - it auto-resumes!
- Progress is saved every 5 sections

### Problem: "Rate limit error"
**Solution:**
- Wait 1 minute
- Run again - script has built-in delays

### Problem: Swedish text not showing
**Solution:**
1. Check browser console for errors
2. Clear browser cache (Ctrl+Shift+R)
3. Verify i18n.js includes Swedish
4. Restart frontend: `sudo supervisorctl restart frontend`

---

## Expected Results

### Translation Quality
✅ **Professional Swedish translations**
- Natural fitness/health terminology
- Consistent across application
- Proper Swedish grammar
- Technical terms preserved

### Coverage
✅ **All 2,020 keys translated**
- auth: Logga in, Registrera
- dashboard: Instrumentpanel, Statistik
- systemSettings: Inställningar, Prenumeration
- community: Gemenskap, Utmaningar
- And 2,000+ more!

### Performance
✅ **No impact on app performance**
- Same load time as English/Norwegian
- Instant language switching
- No additional API calls

---

## Cost Breakdown

**OpenAI GPT-4 API Usage:**
- Input: ~70,000 tokens
- Output: ~70,000 tokens
- Total: $3-5 USD

**Worth it?** Absolutely! Compare to:
- Professional translator: $800-2,000
- Your time: 20+ hours manual work

---

## Sample Swedish Translations

```json
{
  "auth": {
    "login": "Logga in",
    "register": "Registrera dig",
    "password": "Lösenord",
    "forgotPassword": "Glömt lösenord?"
  },
  "dashboard": {
    "welcome": "Välkommen",
    "statistics": "Statistik",
    "workouts": "Träningspass"
  },
  "systemSettings": {
    "cookies": {
      "saveCookieSettings": "Spara cookie-inställningar",
      "detectedCookies": "Upptäckta cookies"
    }
  }
}
```

---

## What's Next?

After Swedish is working, you can easily add more languages:

### Danish
```bash
# Just change target language in the script
python3 translate_to_danish.py
```

### German
```bash
python3 translate_to_german.py
```

### Finnish
```bash
python3 translate_to_finnish.py
```

**Same process, same quality, same cost (~$3-5 per language)!**

---

## Need Help?

**If anything goes wrong:**
1. Check the error message carefully
2. Look at troubleshooting section above
3. Try the validation script: `python3 validate_swedish.py`
4. Check that API key is valid and has credits

**Common issues:**
- ✅ API key not set → Export it again
- ✅ No credits → Add $5 to OpenAI account
- ✅ Rate limit → Wait 1 minute, try again
- ✅ JSON error → Validation will catch it

---

## Summary

**You're just 3 commands away from Swedish translation:**

```bash
# 1. Set API key
export OPENAI_API_KEY="your-key"

# 2. Translate
python3 translate_to_swedish.py

# 3. Validate
python3 validate_swedish.py
```

**Then 2 simple code changes:**
1. Add Swedish to i18n.js
2. Add Swedish to language selector

**Total time: 25-30 minutes**
**Total cost: $3-5**

**Let's do this! 🇸🇪✨**
