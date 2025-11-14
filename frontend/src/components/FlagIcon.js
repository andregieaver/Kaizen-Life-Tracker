import React from 'react';

import { logger } from '../utils/logger';
// Map country names AND nationalities to their ISO 3166-1 alpha-2 codes for flag emojis
const countryToCode = {
  // Common countries and their nationalities
  'United States': 'US',
  'USA': 'US',
  'American': 'US',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'British': 'GB',
  'Canada': 'CA',
  'Canadian': 'CA',
  'Australia': 'AU',
  'Australian': 'AU',
  'Germany': 'DE',
  'German': 'DE',
  'France': 'FR',
  'French': 'FR',
  'Italy': 'IT',
  'Italian': 'IT',
  'Spain': 'ES',
  'Spanish': 'ES',
  'Portugal': 'PT',
  'Portuguese': 'PT',
  'Brazil': 'BR',
  'Brazilian': 'BR',
  'Mexico': 'MX',
  'Mexican': 'MX',
  'Argentina': 'AR',
  'Argentine': 'AR',
  'Argentinian': 'AR',
  'Japan': 'JP',
  'Japanese': 'JP',
  'China': 'CN',
  'Chinese': 'CN',
  'India': 'IN',
  'Indian': 'IN',
  'Russia': 'RU',
  'Russian': 'RU',
  'South Korea': 'KR',
  'Korean': 'KR',
  'Netherlands': 'NL',
  'Dutch': 'NL',
  'Belgium': 'BE',
  'Belgian': 'BE',
  'Switzerland': 'CH',
  'Swiss': 'CH',
  'Sweden': 'SE',
  'Swedish': 'SE',
  'Norway': 'NO',
  'Norwegian': 'NO',
  'Denmark': 'DK',
  'Danish': 'DK',
  'Finland': 'FI',
  'Finnish': 'FI',
  'Poland': 'PL',
  'Polish': 'PL',
  'Ireland': 'IE',
  'Irish': 'IE',
  'Greece': 'GR',
  'Greek': 'GR',
  'Turkey': 'TR',
  'Turkish': 'TR',
  'Egypt': 'EG',
  'Egyptian': 'EG',
  'South Africa': 'ZA',
  'South African': 'ZA',
  'Kenya': 'KE',
  'Kenyan': 'KE',
  'Nigeria': 'NG',
  'Nigerian': 'NG',
  'New Zealand': 'NZ',
  'New Zealander': 'NZ',
  'Singapore': 'SG',
  'Singaporean': 'SG',
  'Thailand': 'TH',
  'Thai': 'TH',
  'Vietnam': 'VN',
  'Vietnamese': 'VN',
  'Philippines': 'PH',
  'Filipino': 'PH',
  'Philippine': 'PH',
  'Indonesia': 'ID',
  'Indonesian': 'ID',
  'Malaysia': 'MY',
  'Malaysian': 'MY',
  'Austria': 'AT',
  'Austrian': 'AT',
  'Czech Republic': 'CZ',
  'Czech': 'CZ',
  'Hungary': 'HU',
  'Hungarian': 'HU',
  'Romania': 'RO',
  'Romanian': 'RO',
  'Ukraine': 'UA',
  'Ukrainian': 'UA',
  'Israel': 'IL',
  'Israeli': 'IL',
  'Saudi Arabia': 'SA',
  'Saudi': 'SA',
  'Saudi Arabian': 'SA',
  'UAE': 'AE',
  'United Arab Emirates': 'AE',
  'Emirati': 'AE',
  'Qatar': 'QA',
  'Qatari': 'QA',
  'Chile': 'CL',
  'Chilean': 'CL',
  'Colombia': 'CO',
  'Colombian': 'CO',
  'Peru': 'PE',
  'Peruvian': 'PE',
  'Venezuela': 'VE',
  'Venezuelan': 'VE',
  'Ecuador': 'EC',
  'Ecuadorian': 'EC',
  'Uruguay': 'UY',
  'Uruguayan': 'UY',
  'Cuba': 'CU',
  'Cuban': 'CU',
  'Jamaica': 'JM',
  'Jamaican': 'JM',
  'Pakistan': 'PK',
  'Pakistani': 'PK',
  'Bangladesh': 'BD',
  'Bangladeshi': 'BD',
  'Sri Lanka': 'LK',
  'Sri Lankan': 'LK',
  'Nepal': 'NP',
  'Nepali': 'NP',
  'Nepalese': 'NP',
  'Myanmar': 'MM',
  'Burmese': 'MM',
  'Cambodia': 'KH',
  'Cambodian': 'KH',
  'Laos': 'LA',
  'Laotian': 'LA',
  'Morocco': 'MA',
  'Moroccan': 'MA',
  'Algeria': 'DZ',
  'Algerian': 'DZ',
  'Tunisia': 'TN',
  'Tunisian': 'TN',
  'Libya': 'LY',
  'Libyan': 'LY',
  'Ethiopia': 'ET',
  'Ethiopian': 'ET',
  'Ghana': 'GH',
  'Ghanaian': 'GH',
  'Tanzania': 'TZ',
  'Tanzanian': 'TZ',
  'Uganda': 'UG',
  'Ugandan': 'UG',
  'Zimbabwe': 'ZW',
  'Zimbabwean': 'ZW',
  'Botswana': 'BW',
  'Botswanan': 'BW',
  'Namibia': 'NA',
  'Namibian': 'NA',
  'Zambia': 'ZM',
  'Zambian': 'ZM',
  'Angola': 'AO',
  'Angolan': 'AO',
  'Mozambique': 'MZ',
  'Mozambican': 'MZ',
  'Senegal': 'SN',
  'Senegalese': 'SN',
  'Ivory Coast': 'CI',
  'Ivorian': 'CI',
  'Cameroon': 'CM',
  'Cameroonian': 'CM',
  'Madagascar': 'MG',
  'Malagasy': 'MG',
  'Croatia': 'HR',
  'Croatian': 'HR',
  'Serbia': 'RS',
  'Serbian': 'RS',
  'Bulgaria': 'BG',
  'Bulgarian': 'BG',
  'Slovakia': 'SK',
  'Slovak': 'SK',
  'Slovenia': 'SI',
  'Slovenian': 'SI',
  'Slovene': 'SI',
  'Lithuania': 'LT',
  'Lithuanian': 'LT',
  'Latvia': 'LV',
  'Latvian': 'LV',
  'Estonia': 'EE',
  'Estonian': 'EE',
  'Iceland': 'IS',
  'Icelandic': 'IS',
  'Icelander': 'IS',
  'Luxembourg': 'LU',
  'Luxembourgish': 'LU',
  'Malta': 'MT',
  'Maltese': 'MT',
  'Cyprus': 'CY',
  'Cypriot': 'CY',
  'Lebanon': 'LB',
  'Lebanese': 'LB',
  'Jordan': 'JO',
  'Jordanian': 'JO',
  'Iraq': 'IQ',
  'Iraqi': 'IQ',
  'Syria': 'SY',
  'Syrian': 'SY',
  'Kuwait': 'KW',
  'Kuwaiti': 'KW',
  'Oman': 'OM',
  'Omani': 'OM',
  'Bahrain': 'BH',
  'Bahraini': 'BH',
  'Yemen': 'YE',
  'Yemeni': 'YE',
  'Afghanistan': 'AF',
  'Afghan': 'AF',
  'Iran': 'IR',
  'Iranian': 'IR',
  'Kazakhstan': 'KZ',
  'Kazakh': 'KZ',
  'Kazakhstani': 'KZ',
  'Uzbekistan': 'UZ',
  'Uzbek': 'UZ',
  'Mongolia': 'MN',
  'Mongolian': 'MN',
  'North Korea': 'KP',
  'North Korean': 'KP',
  'Taiwan': 'TW',
  'Taiwanese': 'TW',
  'Hong Kong': 'HK',
  'Macau': 'MO',
  'Brunei': 'BN',
  'Bruneian': 'BN',
  'Maldives': 'MV',
  'Maldivian': 'MV',
  'Bhutan': 'BT',
  'Bhutanese': 'BT',
  'Papua New Guinea': 'PG',
  'Papua New Guinean': 'PG',
  'Fiji': 'FJ',
  'Fijian': 'FJ',
  'Solomon Islands': 'SB',
  'Samoa': 'WS',
  'Samoan': 'WS',
  'Tonga': 'TO',
  'Tongan': 'TO',
  'Vanuatu': 'VU',
  'Costa Rica': 'CR',
  'Costa Rican': 'CR',
  'Panama': 'PA',
  'Panamanian': 'PA',
  'Guatemala': 'GT',
  'Guatemalan': 'GT',
  'Honduras': 'HN',
  'Honduran': 'HN',
  'El Salvador': 'SV',
  'Salvadoran': 'SV',
  'Nicaragua': 'NI',
  'Nicaraguan': 'NI',
  'Belize': 'BZ',
  'Belizean': 'BZ',
  'Dominican Republic': 'DO',
  'Dominican': 'DO',
  'Haiti': 'HT',
  'Haitian': 'HT',
  'Trinidad and Tobago': 'TT',
  'Trinidadian': 'TT',
  'Barbados': 'BB',
  'Barbadian': 'BB',
  'Bahamas': 'BS',
  'Bahamian': 'BS',
  'Guyana': 'GY',
  'Guyanese': 'GY',
  'Suriname': 'SR',
  'Surinamese': 'SR',
  'Bolivia': 'BO',
  'Bolivian': 'BO',
  'Paraguay': 'PY',
  'Paraguayan': 'PY',
  'Albania': 'AL',
  'Albanian': 'AL',
  'Bosnia and Herzegovina': 'BA',
  'Bosnian': 'BA',
  'North Macedonia': 'MK',
  'Macedonian': 'MK',
  'Montenegro': 'ME',
  'Montenegrin': 'ME',
  'Kosovo': 'XK',
  'Kosovar': 'XK',
  'Moldova': 'MD',
  'Moldovan': 'MD',
  'Belarus': 'BY',
  'Belarusian': 'BY',
  'Armenia': 'AM',
  'Armenian': 'AM',
  'Azerbaijan': 'AZ',
  'Azerbaijani': 'AZ',
  'Georgia': 'GE',
  'Georgian': 'GE',
  'Turkmenistan': 'TM',
  'Turkmen': 'TM',
  'Tajikistan': 'TJ',
  'Tajik': 'TJ',
  'Kyrgyzstan': 'KG',
  'Kyrgyz': 'KG',
};

// Convert country name or nationality to flag emoji
const getFlagEmoji = (countryName) => {
  if (!countryName) return null;
  
  // First, check if it's already a 2-letter country code (e.g., "NO", "US", "GB")
  if (countryName.length === 2) {
    const upperCode = countryName.toUpperCase();
    // Convert country code to flag emoji
    return String.fromCodePoint(
      ...[...upperCode].map(c => 127397 + c.charCodeAt())
    );
  }
  
  // Try to find country code from the mapping
  const countryCode = countryToCode[countryName] || countryToCode[countryName.trim()];
  
  if (!countryCode) {
    // Try case-insensitive match
    const lowerName = countryName.toLowerCase();
    const foundKey = Object.keys(countryToCode).find(
      key => key.toLowerCase() === lowerName
    );
    if (foundKey) {
      const code = countryToCode[foundKey];
      return String.fromCodePoint(
        ...[...code].map(c => 127397 + c.charCodeAt())
      );
    }
    return null;
  }
  
  // Convert country code to flag emoji
  // Flag emojis are created using regional indicator symbols
  // A = 127462 (🇦), B = 127463 (🇧), etc.
  return String.fromCodePoint(
    ...[...countryCode].map(c => 127397 + c.charCodeAt())
  );
};

const FlagIcon = ({ nationality, className = '', size = 'normal' }) => {
  logger.debug(null, '[FlagIcon] Received nationality:', nationality, 'Type:', typeof nationality);
  
  if (!nationality) {
    logger.debug(null, '[FlagIcon] ❌ No nationality provided, returning null');
    return null;
  }
  
  const flag = getFlagEmoji(nationality);
  logger.debug(null, '[FlagIcon] Generated flag:', flag, 'Flag type:', typeof flag, 'Flag length:', flag?.length);
  
  if (!flag) {
    logger.debug(null, '[FlagIcon] ❌ No flag emoji generated for nationality:', nationality);
    return null;
  }
  
  // Size variants: normal (0.9em for 40px images), medium (1.2em for 56px images), large (1.8em for 80px images)
  const fontSize = size === 'large' ? '1.8em' : size === 'medium' ? '1.2em' : '0.9em';
  const bottomOffset = size === 'large' ? '-5px' : size === 'medium' ? '-8px' : '-5px';
  
  logger.debug(null, '[FlagIcon] ✅ Rendering flag:', flag, 'for nationality:', nationality, 'Position:', `right:-5px, bottom:${bottomOffset}`, 'Font size:', fontSize);
  
  // Positioned absolutely in bottom-right corner, sticking out
  return (
    <span 
      className={`absolute ${className}`}
      title={nationality}
      style={{ 
        fontSize: fontSize,
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        zIndex: 10,
        right: '-5px',
        bottom: bottomOffset
      }}
    >
      {flag}
    </span>
  );
};

export default FlagIcon;
