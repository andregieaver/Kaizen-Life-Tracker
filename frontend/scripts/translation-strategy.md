# Multi-Language Translation Strategy
## Goal: Add new language by translating ONE file only

---

## 🎯 Architecture Principles

### 1. **Zero Hardcoded Strings Policy**
- ❌ NEVER: `<h1>Welcome</h1>`
- ✅ ALWAYS: `<h1>{t('dashboard.welcome')}</h1>`

### 2. **Single Source of Truth**
- English (`en.json`) = Master reference
- All other languages = Direct translations of en.json keys
- To add Spanish: Copy en.json → es.json → Translate values

### 3. **Consistent Key Naming**
```javascript
Format: component.section.item
Examples:
  - dashboard.navigation.home
  - nutrition.macros.protein
  - recipes.mealTypes.breakfast
  - account.allergies.dairy
```

---

## 📋 Implementation Checklist

### Phase 1: Complete Audit ✅
- [x] Create string extraction script
- [ ] Run full app scan
- [ ] Document ALL untranslated strings
- [ ] Categorize by component

### Phase 2: Master Translation File (en.json)
- [ ] Add ALL missing English strings
- [ ] Organize by component
- [ ] Add descriptive comments for context
- [ ] Validate no duplicates

### Phase 3: Component Updates
- [ ] Replace ALL hardcoded strings with t()
- [ ] Use translation arrays for lists
- [ ] Add useTranslation hook where missing
- [ ] Test language switching

### Phase 4: Validation
- [ ] Run automated scan (should find 0 strings)
- [ ] Test all components in Norwegian
- [ ] Verify dynamic content works
- [ ] Check edge cases (empty states, errors)

### Phase 5: New Language Template
- [ ] Create `add-language.sh` script
- [ ] Document translation process
- [ ] Create translator guidelines
- [ ] Set up validation workflow

---

## 🔧 Tools & Scripts

### 1. String Extraction
```bash
./scripts/extract-strings.sh > untranslated.txt
```

### 2. Translation Coverage Report
```bash
./scripts/coverage-report.sh
# Outputs: 87% coverage (234/268 strings translated)
```

### 3. Add New Language
```bash
./scripts/add-language.sh es  # Spanish
./scripts/add-language.sh fr  # French
./scripts/add-language.sh de  # German
```

### 4. Validate Translations
```bash
./scripts/validate-translations.sh
# Checks:
# - Missing keys between languages
# - Unused translation keys
# - Hardcoded strings in components
```

---

## 📦 Translation File Structure

```json
{
  "nav": { /* Navigation items */ },
  "common": { /* Shared strings: save, cancel, delete */ },
  "dashboard": { /* Dashboard specific */ },
  "account": { /* Account settings */ },
  "nutrition": { /* Nutrition tracking */ },
  "recipes": { /* Recipe browser */ },
  "community": { /* Community features */ },
  "journal": { /* Journal entries */ },
  "coach": { /* AI coach chat */ },
  "errors": { /* Error messages */ },
  "validation": { /* Form validation */ }
}
```

---

## 🌍 Adding a New Language (3 Steps)

### Step 1: Create Language File
```bash
cp src/locales/en.json src/locales/es.json
```

### Step 2: Translate Values
```json
// en.json
"dashboard": {
  "welcome": "Welcome back",
  "today": "Today"
}

// es.json (translate ONLY values, keep keys)
"dashboard": {
  "welcome": "Bienvenido de nuevo",
  "today": "Hoy"
}
```

### Step 3: Register in i18n.js
```javascript
import es from './locales/es.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    no: { translation: no },
    es: { translation: es }  // Add this line
  }
});
```

---

## ✅ Best Practices

### DO:
- ✅ Use descriptive key names
- ✅ Group related strings together
- ✅ Add comments for context in translation files
- ✅ Use interpolation for dynamic values: `{t('account.characterCount', { count: 50 })}`
- ✅ Test language switching regularly

### DON'T:
- ❌ Hardcode strings in JSX
- ❌ Mix languages in same component
- ❌ Use English strings as keys
- ❌ Forget to add useTranslation hook
- ❌ Skip validation after changes

---

## 🧪 Testing Checklist

Before adding new language:
- [ ] Run string extraction (finds 0 hardcoded strings)
- [ ] Check en.json has ALL app strings
- [ ] Verify no.json matches en.json structure
- [ ] Test language switching in browser
- [ ] Check all modals and dynamic content
- [ ] Verify form validation messages
- [ ] Test error states

---

## 📝 Translator Guidelines

When translating to new language:

1. **Context Matters**: Read surrounding keys for context
2. **Keep Formatting**: Maintain {{interpolation}} syntax
3. **Preserve Meaning**: Translate intent, not word-for-word
4. **Cultural Adaptation**: Use culturally appropriate terms
5. **Consistency**: Use same terms for same concepts
6. **Length Consideration**: Check UI doesn't break with longer text
7. **Ask Questions**: When unclear, ask for clarification

---

## 📊 Current Status

| Language | Status | Coverage |
|----------|--------|----------|
| English (en) | ✅ Master | 100% |
| Norwegian (no) | 🟡 In Progress | ~60% |
| Spanish (es) | ⭕ Not Started | 0% |
| French (fr) | ⭕ Not Started | 0% |
| German (de) | ⭕ Not Started | 0% |

---

## 🎯 Next Steps

1. Complete Account.js translation (Norwegian)
2. Run full app string extraction
3. Add ALL strings to en.json
4. Update ALL components to use t()
5. Complete no.json translation
6. Create add-language automation
7. Document for external translators
