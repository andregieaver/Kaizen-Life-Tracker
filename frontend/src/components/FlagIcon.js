import React from 'react';

// Map country names to their ISO 3166-1 alpha-2 codes for flag emojis
const countryToCode = {
  // Common countries
  'United States': 'US',
  'USA': 'US',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Portugal': 'PT',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'Argentina': 'AR',
  'Japan': 'JP',
  'China': 'CN',
  'India': 'IN',
  'Russia': 'RU',
  'South Korea': 'KR',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Poland': 'PL',
  'Ireland': 'IE',
  'Greece': 'GR',
  'Turkey': 'TR',
  'Egypt': 'EG',
  'South Africa': 'ZA',
  'Kenya': 'KE',
  'Nigeria': 'NG',
  'New Zealand': 'NZ',
  'Singapore': 'SG',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'Austria': 'AT',
  'Czech Republic': 'CZ',
  'Hungary': 'HU',
  'Romania': 'RO',
  'Ukraine': 'UA',
  'Israel': 'IL',
  'Saudi Arabia': 'SA',
  'UAE': 'AE',
  'United Arab Emirates': 'AE',
  'Qatar': 'QA',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Peru': 'PE',
  'Venezuela': 'VE',
  'Ecuador': 'EC',
  'Uruguay': 'UY',
  'Cuba': 'CU',
  'Jamaica': 'JM',
  'Pakistan': 'PK',
  'Bangladesh': 'BD',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Myanmar': 'MM',
  'Cambodia': 'KH',
  'Laos': 'LA',
  'Morocco': 'MA',
  'Algeria': 'DZ',
  'Tunisia': 'TN',
  'Libya': 'LY',
  'Ethiopia': 'ET',
  'Ghana': 'GH',
  'Tanzania': 'TZ',
  'Uganda': 'UG',
  'Zimbabwe': 'ZW',
  'Botswana': 'BW',
  'Namibia': 'NA',
  'Zambia': 'ZM',
  'Angola': 'AO',
  'Mozambique': 'MZ',
  'Senegal': 'SN',
  'Ivory Coast': 'CI',
  'Cameroon': 'CM',
  'Madagascar': 'MG',
  'Croatia': 'HR',
  'Serbia': 'RS',
  'Bulgaria': 'BG',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Lithuania': 'LT',
  'Latvia': 'LV',
  'Estonia': 'EE',
  'Iceland': 'IS',
  'Luxembourg': 'LU',
  'Malta': 'MT',
  'Cyprus': 'CY',
  'Lebanon': 'LB',
  'Jordan': 'JO',
  'Iraq': 'IQ',
  'Syria': 'SY',
  'Kuwait': 'KW',
  'Oman': 'OM',
  'Bahrain': 'BH',
  'Yemen': 'YE',
  'Afghanistan': 'AF',
  'Iran': 'IR',
  'Kazakhstan': 'KZ',
  'Uzbekistan': 'UZ',
  'Mongolia': 'MN',
  'North Korea': 'KP',
  'Taiwan': 'TW',
  'Hong Kong': 'HK',
  'Macau': 'MO',
  'Brunei': 'BN',
  'Maldives': 'MV',
  'Bhutan': 'BT',
  'Papua New Guinea': 'PG',
  'Fiji': 'FJ',
  'Solomon Islands': 'SB',
  'Samoa': 'WS',
  'Tonga': 'TO',
  'Vanuatu': 'VU',
  'Costa Rica': 'CR',
  'Panama': 'PA',
  'Guatemala': 'GT',
  'Honduras': 'HN',
  'El Salvador': 'SV',
  'Nicaragua': 'NI',
  'Belize': 'BZ',
  'Dominican Republic': 'DO',
  'Haiti': 'HT',
  'Trinidad and Tobago': 'TT',
  'Barbados': 'BB',
  'Bahamas': 'BS',
  'Guyana': 'GY',
  'Suriname': 'SR',
  'Bolivia': 'BO',
  'Paraguay': 'PY',
  'Albania': 'AL',
  'Bosnia and Herzegovina': 'BA',
  'North Macedonia': 'MK',
  'Montenegro': 'ME',
  'Kosovo': 'XK',
  'Moldova': 'MD',
  'Belarus': 'BY',
  'Armenia': 'AM',
  'Azerbaijan': 'AZ',
  'Georgia': 'GE',
  'Turkmenistan': 'TM',
  'Tajikistan': 'TJ',
  'Kyrgyzstan': 'KG',
};

// Convert country name to flag emoji
const getFlagEmoji = (countryName) => {
  if (!countryName) return null;
  
  // Try to find country code
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

const FlagIcon = ({ nationality, className = '' }) => {
  if (!nationality) return null;
  
  const flag = getFlagEmoji(nationality);
  
  if (!flag) return null;
  
  return (
    <span 
      className={`inline-block ml-1.5 ${className}`}
      title={nationality}
      style={{ fontSize: '1em' }}
    >
      {flag}
    </span>
  );
};

export default FlagIcon;
