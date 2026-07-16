/**
 * Canonical world geo seed for cascading Location dropdowns.
 * Upserted into continents / countries / provinces when tables are sparse.
 */

export type SeedContinent = { name: string; code: string };
export type SeedCountry = {
  name: string;
  continent: string;
  iso2?: string;
  flag?: string;
};
export type SeedProvince = { country: string; name: string };

export const SEED_CONTINENTS: SeedContinent[] = [
  { name: 'Africa', code: 'AF' },
  { name: 'Antarctica', code: 'AN' },
  { name: 'Asia', code: 'AS' },
  { name: 'Europe', code: 'EU' },
  { name: 'North America', code: 'NA' },
  { name: 'Oceania', code: 'OC' },
  { name: 'South America', code: 'SA' },
];

/** Full UN-style country list with continent mapping */
export const SEED_COUNTRIES: SeedCountry[] = [
  // Africa
  { name: 'Algeria', continent: 'Africa', iso2: 'DZ', flag: '🇩🇿' },
  { name: 'Angola', continent: 'Africa', iso2: 'AO', flag: '🇦🇴' },
  { name: 'Benin', continent: 'Africa', iso2: 'BJ', flag: '🇧🇯' },
  { name: 'Botswana', continent: 'Africa', iso2: 'BW', flag: '🇧🇼' },
  { name: 'Burkina Faso', continent: 'Africa', iso2: 'BF', flag: '🇧🇫' },
  { name: 'Burundi', continent: 'Africa', iso2: 'BI', flag: '🇧🇮' },
  { name: 'Cabo Verde', continent: 'Africa', iso2: 'CV', flag: '🇨🇻' },
  { name: 'Cameroon', continent: 'Africa', iso2: 'CM', flag: '🇨🇲' },
  { name: 'Central African Republic', continent: 'Africa', iso2: 'CF', flag: '🇨🇫' },
  { name: 'Chad', continent: 'Africa', iso2: 'TD', flag: '🇹🇩' },
  { name: 'Comoros', continent: 'Africa', iso2: 'KM', flag: '🇰🇲' },
  { name: 'Congo', continent: 'Africa', iso2: 'CG', flag: '🇨🇬' },
  { name: 'Democratic Republic of the Congo', continent: 'Africa', iso2: 'CD', flag: '🇨🇩' },
  { name: 'Côte d’Ivoire', continent: 'Africa', iso2: 'CI', flag: '🇨🇮' },
  { name: 'Djibouti', continent: 'Africa', iso2: 'DJ', flag: '🇩🇯' },
  { name: 'Egypt', continent: 'Africa', iso2: 'EG', flag: '🇪🇬' },
  { name: 'Equatorial Guinea', continent: 'Africa', iso2: 'GQ', flag: '🇬🇶' },
  { name: 'Eritrea', continent: 'Africa', iso2: 'ER', flag: '🇪🇷' },
  { name: 'Eswatini', continent: 'Africa', iso2: 'SZ', flag: '🇸🇿' },
  { name: 'Ethiopia', continent: 'Africa', iso2: 'ET', flag: '🇪🇹' },
  { name: 'Gabon', continent: 'Africa', iso2: 'GA', flag: '🇬🇦' },
  { name: 'Gambia', continent: 'Africa', iso2: 'GM', flag: '🇬🇲' },
  { name: 'Ghana', continent: 'Africa', iso2: 'GH', flag: '🇬🇭' },
  { name: 'Guinea', continent: 'Africa', iso2: 'GN', flag: '🇬🇳' },
  { name: 'Guinea-Bissau', continent: 'Africa', iso2: 'GW', flag: '🇬🇼' },
  { name: 'Kenya', continent: 'Africa', iso2: 'KE', flag: '🇰🇪' },
  { name: 'Lesotho', continent: 'Africa', iso2: 'LS', flag: '🇱🇸' },
  { name: 'Liberia', continent: 'Africa', iso2: 'LR', flag: '🇱🇷' },
  { name: 'Libya', continent: 'Africa', iso2: 'LY', flag: '🇱🇾' },
  { name: 'Madagascar', continent: 'Africa', iso2: 'MG', flag: '🇲🇬' },
  { name: 'Malawi', continent: 'Africa', iso2: 'MW', flag: '🇲🇼' },
  { name: 'Mali', continent: 'Africa', iso2: 'ML', flag: '🇲🇱' },
  { name: 'Mauritania', continent: 'Africa', iso2: 'MR', flag: '🇲🇷' },
  { name: 'Mauritius', continent: 'Africa', iso2: 'MU', flag: '🇲🇺' },
  { name: 'Morocco', continent: 'Africa', iso2: 'MA', flag: '🇲🇦' },
  { name: 'Mozambique', continent: 'Africa', iso2: 'MZ', flag: '🇲🇿' },
  { name: 'Namibia', continent: 'Africa', iso2: 'NA', flag: '🇳🇦' },
  { name: 'Niger', continent: 'Africa', iso2: 'NE', flag: '🇳🇪' },
  { name: 'Nigeria', continent: 'Africa', iso2: 'NG', flag: '🇳🇬' },
  { name: 'Rwanda', continent: 'Africa', iso2: 'RW', flag: '🇷🇼' },
  { name: 'São Tomé and Príncipe', continent: 'Africa', iso2: 'ST', flag: '🇸🇹' },
  { name: 'Senegal', continent: 'Africa', iso2: 'SN', flag: '🇸🇳' },
  { name: 'Seychelles', continent: 'Africa', iso2: 'SC', flag: '🇸🇨' },
  { name: 'Sierra Leone', continent: 'Africa', iso2: 'SL', flag: '🇸🇱' },
  { name: 'Somalia', continent: 'Africa', iso2: 'SO', flag: '🇸🇴' },
  { name: 'South Africa', continent: 'Africa', iso2: 'ZA', flag: '🇿🇦' },
  { name: 'South Sudan', continent: 'Africa', iso2: 'SS', flag: '🇸🇸' },
  { name: 'Sudan', continent: 'Africa', iso2: 'SD', flag: '🇸🇩' },
  { name: 'Tanzania', continent: 'Africa', iso2: 'TZ', flag: '🇹🇿' },
  { name: 'Togo', continent: 'Africa', iso2: 'TG', flag: '🇹🇬' },
  { name: 'Tunisia', continent: 'Africa', iso2: 'TN', flag: '🇹🇳' },
  { name: 'Uganda', continent: 'Africa', iso2: 'UG', flag: '🇺🇬' },
  { name: 'Zambia', continent: 'Africa', iso2: 'ZM', flag: '🇿🇲' },
  { name: 'Zimbabwe', continent: 'Africa', iso2: 'ZW', flag: '🇿🇼' },

  // Asia
  { name: 'Afghanistan', continent: 'Asia', iso2: 'AF', flag: '🇦🇫' },
  { name: 'Armenia', continent: 'Asia', iso2: 'AM', flag: '🇦🇲' },
  { name: 'Azerbaijan', continent: 'Asia', iso2: 'AZ', flag: '🇦🇿' },
  { name: 'Bahrain', continent: 'Asia', iso2: 'BH', flag: '🇧🇭' },
  { name: 'Bangladesh', continent: 'Asia', iso2: 'BD', flag: '🇧🇩' },
  { name: 'Bhutan', continent: 'Asia', iso2: 'BT', flag: '🇧🇹' },
  { name: 'Brunei', continent: 'Asia', iso2: 'BN', flag: '🇧🇳' },
  { name: 'Cambodia', continent: 'Asia', iso2: 'KH', flag: '🇰🇭' },
  { name: 'China', continent: 'Asia', iso2: 'CN', flag: '🇨🇳' },
  { name: 'Georgia', continent: 'Asia', iso2: 'GE', flag: '🇬🇪' },
  { name: 'India', continent: 'Asia', iso2: 'IN', flag: '🇮🇳' },
  { name: 'Indonesia', continent: 'Asia', iso2: 'ID', flag: '🇮🇩' },
  { name: 'Iran', continent: 'Asia', iso2: 'IR', flag: '🇮🇷' },
  { name: 'Iraq', continent: 'Asia', iso2: 'IQ', flag: '🇮🇶' },
  { name: 'Israel', continent: 'Asia', iso2: 'IL', flag: '🇮🇱' },
  { name: 'Japan', continent: 'Asia', iso2: 'JP', flag: '🇯🇵' },
  { name: 'Jordan', continent: 'Asia', iso2: 'JO', flag: '🇯🇴' },
  { name: 'Kazakhstan', continent: 'Asia', iso2: 'KZ', flag: '🇰🇿' },
  { name: 'Kuwait', continent: 'Asia', iso2: 'KW', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', continent: 'Asia', iso2: 'KG', flag: '🇰🇬' },
  { name: 'Laos', continent: 'Asia', iso2: 'LA', flag: '🇱🇦' },
  { name: 'Lebanon', continent: 'Asia', iso2: 'LB', flag: '🇱🇧' },
  { name: 'Malaysia', continent: 'Asia', iso2: 'MY', flag: '🇲🇾' },
  { name: 'Maldives', continent: 'Asia', iso2: 'MV', flag: '🇲🇻' },
  { name: 'Mongolia', continent: 'Asia', iso2: 'MN', flag: '🇲🇳' },
  { name: 'Myanmar', continent: 'Asia', iso2: 'MM', flag: '🇲🇲' },
  { name: 'Nepal', continent: 'Asia', iso2: 'NP', flag: '🇳🇵' },
  { name: 'North Korea', continent: 'Asia', iso2: 'KP', flag: '🇰🇵' },
  { name: 'Oman', continent: 'Asia', iso2: 'OM', flag: '🇴🇲' },
  { name: 'Pakistan', continent: 'Asia', iso2: 'PK', flag: '🇵🇰' },
  { name: 'Palestine', continent: 'Asia', iso2: 'PS', flag: '🇵🇸' },
  { name: 'Philippines', continent: 'Asia', iso2: 'PH', flag: '🇵🇭' },
  { name: 'Qatar', continent: 'Asia', iso2: 'QA', flag: '🇶🇦' },
  { name: 'Saudi Arabia', continent: 'Asia', iso2: 'SA', flag: '🇸🇦' },
  { name: 'Singapore', continent: 'Asia', iso2: 'SG', flag: '🇸🇬' },
  { name: 'South Korea', continent: 'Asia', iso2: 'KR', flag: '🇰🇷' },
  { name: 'Sri Lanka', continent: 'Asia', iso2: 'LK', flag: '🇱🇰' },
  { name: 'Syria', continent: 'Asia', iso2: 'SY', flag: '🇸🇾' },
  { name: 'Taiwan', continent: 'Asia', iso2: 'TW', flag: '🇹🇼' },
  { name: 'Tajikistan', continent: 'Asia', iso2: 'TJ', flag: '🇹🇯' },
  { name: 'Thailand', continent: 'Asia', iso2: 'TH', flag: '🇹🇭' },
  { name: 'Timor-Leste', continent: 'Asia', iso2: 'TL', flag: '🇹🇱' },
  { name: 'Turkey', continent: 'Asia', iso2: 'TR', flag: '🇹🇷' },
  { name: 'Turkmenistan', continent: 'Asia', iso2: 'TM', flag: '🇹🇲' },
  { name: 'United Arab Emirates', continent: 'Asia', iso2: 'AE', flag: '🇦🇪' },
  { name: 'Uzbekistan', continent: 'Asia', iso2: 'UZ', flag: '🇺🇿' },
  { name: 'Vietnam', continent: 'Asia', iso2: 'VN', flag: '🇻🇳' },
  { name: 'Yemen', continent: 'Asia', iso2: 'YE', flag: '🇾🇪' },

  // Europe
  { name: 'Albania', continent: 'Europe', iso2: 'AL', flag: '🇦🇱' },
  { name: 'Andorra', continent: 'Europe', iso2: 'AD', flag: '🇦🇩' },
  { name: 'Austria', continent: 'Europe', iso2: 'AT', flag: '🇦🇹' },
  { name: 'Belarus', continent: 'Europe', iso2: 'BY', flag: '🇧🇾' },
  { name: 'Belgium', continent: 'Europe', iso2: 'BE', flag: '🇧🇪' },
  { name: 'Bosnia and Herzegovina', continent: 'Europe', iso2: 'BA', flag: '🇧🇦' },
  { name: 'Bulgaria', continent: 'Europe', iso2: 'BG', flag: '🇧🇬' },
  { name: 'Croatia', continent: 'Europe', iso2: 'HR', flag: '🇭🇷' },
  { name: 'Cyprus', continent: 'Europe', iso2: 'CY', flag: '🇨🇾' },
  { name: 'Czechia', continent: 'Europe', iso2: 'CZ', flag: '🇨🇿' },
  { name: 'Denmark', continent: 'Europe', iso2: 'DK', flag: '🇩🇰' },
  { name: 'Estonia', continent: 'Europe', iso2: 'EE', flag: '🇪🇪' },
  { name: 'Finland', continent: 'Europe', iso2: 'FI', flag: '🇫🇮' },
  { name: 'France', continent: 'Europe', iso2: 'FR', flag: '🇫🇷' },
  { name: 'Germany', continent: 'Europe', iso2: 'DE', flag: '🇩🇪' },
  { name: 'Greece', continent: 'Europe', iso2: 'GR', flag: '🇬🇷' },
  { name: 'Hungary', continent: 'Europe', iso2: 'HU', flag: '🇭🇺' },
  { name: 'Iceland', continent: 'Europe', iso2: 'IS', flag: '🇮🇸' },
  { name: 'Ireland', continent: 'Europe', iso2: 'IE', flag: '🇮🇪' },
  { name: 'Italy', continent: 'Europe', iso2: 'IT', flag: '🇮🇹' },
  { name: 'Kosovo', continent: 'Europe', iso2: 'XK', flag: '🇽🇰' },
  { name: 'Latvia', continent: 'Europe', iso2: 'LV', flag: '🇱🇻' },
  { name: 'Liechtenstein', continent: 'Europe', iso2: 'LI', flag: '🇱🇮' },
  { name: 'Lithuania', continent: 'Europe', iso2: 'LT', flag: '🇱🇹' },
  { name: 'Luxembourg', continent: 'Europe', iso2: 'LU', flag: '🇱🇺' },
  { name: 'Malta', continent: 'Europe', iso2: 'MT', flag: '🇲🇹' },
  { name: 'Moldova', continent: 'Europe', iso2: 'MD', flag: '🇲🇩' },
  { name: 'Monaco', continent: 'Europe', iso2: 'MC', flag: '🇲🇨' },
  { name: 'Montenegro', continent: 'Europe', iso2: 'ME', flag: '🇲🇪' },
  { name: 'Netherlands', continent: 'Europe', iso2: 'NL', flag: '🇳🇱' },
  { name: 'North Macedonia', continent: 'Europe', iso2: 'MK', flag: '🇲🇰' },
  { name: 'Norway', continent: 'Europe', iso2: 'NO', flag: '🇳🇴' },
  { name: 'Poland', continent: 'Europe', iso2: 'PL', flag: '🇵🇱' },
  { name: 'Portugal', continent: 'Europe', iso2: 'PT', flag: '🇵🇹' },
  { name: 'Romania', continent: 'Europe', iso2: 'RO', flag: '🇷🇴' },
  { name: 'Russia', continent: 'Europe', iso2: 'RU', flag: '🇷🇺' },
  { name: 'San Marino', continent: 'Europe', iso2: 'SM', flag: '🇸🇲' },
  { name: 'Serbia', continent: 'Europe', iso2: 'RS', flag: '🇷🇸' },
  { name: 'Slovakia', continent: 'Europe', iso2: 'SK', flag: '🇸🇰' },
  { name: 'Slovenia', continent: 'Europe', iso2: 'SI', flag: '🇸🇮' },
  { name: 'Spain', continent: 'Europe', iso2: 'ES', flag: '🇪🇸' },
  { name: 'Sweden', continent: 'Europe', iso2: 'SE', flag: '🇸🇪' },
  { name: 'Switzerland', continent: 'Europe', iso2: 'CH', flag: '🇨🇭' },
  { name: 'Ukraine', continent: 'Europe', iso2: 'UA', flag: '🇺🇦' },
  { name: 'United Kingdom', continent: 'Europe', iso2: 'GB', flag: '🇬🇧' },
  { name: 'Vatican City', continent: 'Europe', iso2: 'VA', flag: '🇻🇦' },

  // North America
  { name: 'Antigua and Barbuda', continent: 'North America', iso2: 'AG', flag: '🇦🇬' },
  { name: 'Bahamas', continent: 'North America', iso2: 'BS', flag: '🇧🇸' },
  { name: 'Barbados', continent: 'North America', iso2: 'BB', flag: '🇧🇧' },
  { name: 'Belize', continent: 'North America', iso2: 'BZ', flag: '🇧🇿' },
  { name: 'Canada', continent: 'North America', iso2: 'CA', flag: '🇨🇦' },
  { name: 'Costa Rica', continent: 'North America', iso2: 'CR', flag: '🇨🇷' },
  { name: 'Cuba', continent: 'North America', iso2: 'CU', flag: '🇨🇺' },
  { name: 'Dominica', continent: 'North America', iso2: 'DM', flag: '🇩🇲' },
  { name: 'Dominican Republic', continent: 'North America', iso2: 'DO', flag: '🇩🇴' },
  { name: 'El Salvador', continent: 'North America', iso2: 'SV', flag: '🇸🇻' },
  { name: 'Grenada', continent: 'North America', iso2: 'GD', flag: '🇬🇩' },
  { name: 'Guatemala', continent: 'North America', iso2: 'GT', flag: '🇬🇹' },
  { name: 'Haiti', continent: 'North America', iso2: 'HT', flag: '🇭🇹' },
  { name: 'Honduras', continent: 'North America', iso2: 'HN', flag: '🇭🇳' },
  { name: 'Jamaica', continent: 'North America', iso2: 'JM', flag: '🇯🇲' },
  { name: 'Mexico', continent: 'North America', iso2: 'MX', flag: '🇲🇽' },
  { name: 'Nicaragua', continent: 'North America', iso2: 'NI', flag: '🇳🇮' },
  { name: 'Panama', continent: 'North America', iso2: 'PA', flag: '🇵🇦' },
  { name: 'Saint Kitts and Nevis', continent: 'North America', iso2: 'KN', flag: '🇰🇳' },
  { name: 'Saint Lucia', continent: 'North America', iso2: 'LC', flag: '🇱🇨' },
  { name: 'Saint Vincent and the Grenadines', continent: 'North America', iso2: 'VC', flag: '🇻🇨' },
  { name: 'Trinidad and Tobago', continent: 'North America', iso2: 'TT', flag: '🇹🇹' },
  { name: 'United States', continent: 'North America', iso2: 'US', flag: '🇺🇸' },

  // South America
  { name: 'Argentina', continent: 'South America', iso2: 'AR', flag: '🇦🇷' },
  { name: 'Bolivia', continent: 'South America', iso2: 'BO', flag: '🇧🇴' },
  { name: 'Brazil', continent: 'South America', iso2: 'BR', flag: '🇧🇷' },
  { name: 'Chile', continent: 'South America', iso2: 'CL', flag: '🇨🇱' },
  { name: 'Colombia', continent: 'South America', iso2: 'CO', flag: '🇨🇴' },
  { name: 'Ecuador', continent: 'South America', iso2: 'EC', flag: '🇪🇨' },
  { name: 'Guyana', continent: 'South America', iso2: 'GY', flag: '🇬🇾' },
  { name: 'Paraguay', continent: 'South America', iso2: 'PY', flag: '🇵🇾' },
  { name: 'Peru', continent: 'South America', iso2: 'PE', flag: '🇵🇪' },
  { name: 'Suriname', continent: 'South America', iso2: 'SR', flag: '🇸🇷' },
  { name: 'Uruguay', continent: 'South America', iso2: 'UY', flag: '🇺🇾' },
  { name: 'Venezuela', continent: 'South America', iso2: 'VE', flag: '🇻🇪' },

  // Oceania
  { name: 'Australia', continent: 'Oceania', iso2: 'AU', flag: '🇦🇺' },
  { name: 'Fiji', continent: 'Oceania', iso2: 'FJ', flag: '🇫🇯' },
  { name: 'Kiribati', continent: 'Oceania', iso2: 'KI', flag: '🇰🇮' },
  { name: 'Marshall Islands', continent: 'Oceania', iso2: 'MH', flag: '🇲🇭' },
  { name: 'Micronesia', continent: 'Oceania', iso2: 'FM', flag: '🇫🇲' },
  { name: 'Nauru', continent: 'Oceania', iso2: 'NR', flag: '🇳🇷' },
  { name: 'New Zealand', continent: 'Oceania', iso2: 'NZ', flag: '🇳🇿' },
  { name: 'Palau', continent: 'Oceania', iso2: 'PW', flag: '🇵🇼' },
  { name: 'Papua New Guinea', continent: 'Oceania', iso2: 'PG', flag: '🇵🇬' },
  { name: 'Samoa', continent: 'Oceania', iso2: 'WS', flag: '🇼🇸' },
  { name: 'Solomon Islands', continent: 'Oceania', iso2: 'SB', flag: '🇸🇧' },
  { name: 'Tonga', continent: 'Oceania', iso2: 'TO', flag: '🇹🇴' },
  { name: 'Tuvalu', continent: 'Oceania', iso2: 'TV', flag: '🇹🇻' },
  { name: 'Vanuatu', continent: 'Oceania', iso2: 'VU', flag: '🇻🇺' },
];

/** Provinces / states for major markets (others can be added over time) */
export const SEED_PROVINCES: SeedProvince[] = [
  // South Africa
  ...[
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape',
  ].map((name) => ({ country: 'South Africa', name })),

  // United States
  ...[
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming', 'District of Columbia',
  ].map((name) => ({ country: 'United States', name })),

  // Canada
  ...[
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut',
    'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon',
  ].map((name) => ({ country: 'Canada', name })),

  // Australia
  ...[
    'Australian Capital Territory', 'New South Wales', 'Northern Territory',
    'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ].map((name) => ({ country: 'Australia', name })),

  // United Kingdom
  ...['England', 'Scotland', 'Wales', 'Northern Ireland'].map((name) => ({
    country: 'United Kingdom',
    name,
  })),

  // Nigeria
  ...[
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara',
  ].map((name) => ({ country: 'Nigeria', name })),

  // Kenya
  ...[
    'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
    'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
    'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
    'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi',
    'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
    'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
  ].map((name) => ({ country: 'Kenya', name })),

  // India (states + UTs abbreviated set of major)
  ...[
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
    'Lakshadweep', 'Puducherry',
  ].map((name) => ({ country: 'India', name })),

  // Brazil regions/states
  ...[
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
    'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
    'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina',
    'São Paulo', 'Sergipe', 'Tocantins',
  ].map((name) => ({ country: 'Brazil', name })),

  // Germany
  ...[
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse',
    'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate',
    'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ].map((name) => ({ country: 'Germany', name })),

  // UAE emirates
  ...[
    'Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain',
  ].map((name) => ({ country: 'United Arab Emirates', name })),

  // Namibia
  ...[
    'Erongo', 'Hardap', '//Karas', 'Kavango East', 'Kavango West', 'Khomas', 'Kunene',
    'Ohangwena', 'Omaheke', 'Omusati', 'Oshana', 'Oshikoto', 'Otjozondjupa', 'Zambezi',
  ].map((name) => ({ country: 'Namibia', name })),

  // Botswana
  ...[
    'Central', 'Ghanzi', 'Kgalagadi', 'Kgatleng', 'Kweneng', 'North-East', 'North-West',
    'South-East', 'Southern', 'Chobe',
  ].map((name) => ({ country: 'Botswana', name })),

  // Ghana
  ...[
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra',
    'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta',
    'Western', 'Western North',
  ].map((name) => ({ country: 'Ghana', name })),

  // New Zealand
  ...[
    'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', "Hawke's Bay", 'Manawatū-Whanganui',
    'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman',
    'Waikato', 'Wellington', 'West Coast',
  ].map((name) => ({ country: 'New Zealand', name })),
];
