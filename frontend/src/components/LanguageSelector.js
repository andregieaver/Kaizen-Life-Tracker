import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from './ui/label';
import { Globe } from 'lucide-react';

const LanguageSelector = () => {
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

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center text-gray-700">
        <Globe className="w-4 h-4 mr-2" />
        {t('account.language')}
      </Label>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
