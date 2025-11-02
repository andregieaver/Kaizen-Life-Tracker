// Centralized translation data utilities
import { useTranslation } from 'react-i18next';
import countriesData from '../locales/data/countries.json';

/**
 * Hook to get translated country/nationality list
 * @returns {Array} Array of {value, label} objects with translated country names
 */
export const useCountries = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';
  
  const countries = countriesData[currentLang] || countriesData.en;
  
  return Object.entries(countries).map(([value, label]) => ({
    value,
    label
  }));
};

/**
 * Get translated country name
 * @param {string} countryKey - Country key (e.g., "American")
 * @returns {string} Translated country name
 */
export const getCountryName = (countryKey, language = 'en') => {
  return countriesData[language]?.[countryKey] || countryKey;
};

export default {
  useCountries,
  getCountryName
};
