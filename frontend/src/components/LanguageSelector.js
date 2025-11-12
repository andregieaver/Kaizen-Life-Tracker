import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from './ui/label';
import { Globe } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const LanguageSelector = ({ athleteId }) => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'no', name: 'Norsk', flag: '🇳🇴' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
    { code: 'da', name: 'Dansk', flag: '🇩🇰' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' }
  ];

  const changeLanguage = async (lng) => {
    console.log(`[LanguageSelector] Changing language to: ${lng}`);
    console.log(`[LanguageSelector] athleteId:`, athleteId);
    
    // Change UI language immediately
    i18n.changeLanguage(lng);
    
    // Save language preference to athlete profile in database
    if (athleteId) {
      try {
        const url = `${API}/athlete/${athleteId}`;
        console.log(`[LanguageSelector] Making PUT request to:`, url);
        console.log(`[LanguageSelector] With data:`, { language: lng });
        
        const response = await axios.put(url, { language: lng });
        console.log(`[LanguageSelector] Language preference saved successfully:`, response.data);
        
        // Trigger menu reload to apply new translations
        window.dispatchEvent(new Event('menusUpdated'));
        console.log(`[LanguageSelector] Dispatched menusUpdated event`);
      } catch (error) {
        console.error('[LanguageSelector] Error saving language preference:', error);
        console.error('[LanguageSelector] Error details:', error.response?.data);
      }
    } else {
      console.warn('[LanguageSelector] No athleteId provided, language not saved to database');
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center text-white">
        <Globe className="w-4 h-4 mr-2" />
        {t('account.language')}
      </Label>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2A8] text-white"
        style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}
        data-testid="language-selector"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        {t('account.selectLanguage')}
      </p>
    </div>
  );
};

export default LanguageSelector;
