import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from './ui/label';
import { Globe } from 'lucide-react';
import axios from 'axios';
import SearchableSelect from './community/SearchableSelect';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  const changeLanguage = async (lng) => {
    logger.debug(null, `[LanguageSelector] Changing language to: ${lng}`);
    
    // Change UI language immediately
    i18n.changeLanguage(lng);
    
    // Save language preference to athlete profile in database
    if (athleteId) {
      try {
        const url = `${API}/system/set-language?athlete_id=${athleteId}&language=${lng}`;
        logger.debug(null, `[LanguageSelector] Calling set-language endpoint:`, url);
        
        const response = await axios.post(url);
        logger.debug(null, `[LanguageSelector] Language saved:`, response.data);
        
        // Trigger menu reload to apply new translations
        window.dispatchEvent(new Event('menusUpdated'));
        
        // Also reload the page after a short delay to ensure everything updates
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        logger.error(null, '[LanguageSelector] Error saving language:', error);
        logger.error(null, '[LanguageSelector] Error details:', error.response?.data);
      }
    } else {
      logger.warn(null, '[LanguageSelector] No athleteId provided, language not saved');
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center text-white">
        <Globe className="w-4 h-4 mr-2" />
        {t('account.language')}
      </Label>
      <SearchableSelect
        value={i18n.language}
        onChange={changeLanguage}
        options={languages.map((lang) => ({
          value: lang.code,
          label: `${lang.flag} ${lang.name}`
        }))}
        placeholder={t('account.selectLanguage')}
        searchPlaceholder={t('community.searchLanguage')}
      />
      <p className="text-xs text-gray-500">
        {t('account.selectLanguage')}
      </p>
    </div>
  );
};

export default LanguageSelector;
