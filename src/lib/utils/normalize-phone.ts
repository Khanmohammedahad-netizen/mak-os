/**
 * Normalizes a phone number to E.164 format based on business location.
 * Helps correct bad scrapes (e.g. US numbers for Dubai businesses).
 */

export function normalizeWhatsAppNumber(phone: string, city: string, country: string): string | null {
  // Step 0: E.164 Pass-through (TRUST if starts with + and has 10-15 digits)
  if (phone.startsWith('+')) {
    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`
    }
  }

  // Country code map
  const countryCodeMap: Record<string, string> = {
    // GCC
    'dubai': '971', 'abu dhabi': '971', 'sharjah': '971',
    'ajman': '971', 'ras al khaimah': '971', 'fujairah': '971',
    'uae': '971', 'united arab emirates': '971',
    'riyadh': '966', 'jeddah': '966', 'dammam': '966',
    'saudi arabia': '966', 'ksa': '966',
    'doha': '974', 'qatar': '974',
    'kuwait city': '965', 'kuwait': '965',
    'muscat': '968', 'oman': '968',
    'manama': '973', 'bahrain': '973',
    // Asia
    'mumbai': '91', 'delhi': '91', 'bangalore': '91',
    'hyderabad': '91', 'india': '91',
    'tokyo': '81', 'osaka': '81', 'japan': '81',
    'kashima': '81',
    // Europe
    'london': '44', 'manchester': '44', 'uk': '44',
    'paris': '33', 'france': '33',
    'berlin': '49', 'germany': '49',
    // Oceania
    'sydney': '61', 'melbourne': '61', 'australia': '61',
    // North America
    'new york': '1', 'los angeles': '1', 'usa': '1',
    'toronto': '1', 'canada': '1',
  }

  // Step 1: Determine correct country code from city or country
  const lookupCity = city?.toLowerCase().trim() || ''
  const lookupCountry = country?.toLowerCase().trim() || ''
  
  const correctCode = countryCodeMap[lookupCity] || countryCodeMap[lookupCountry] || null
  if (!correctCode) return null // unknown region, skip
  
  // Step 2: Strip everything except digits from the raw phone
  const digitsOnly = phone.replace(/\D/g, '')

  // Step 3: Remove any leading country code and get local number
  let localNumber = digitsOnly
  if (digitsOnly.startsWith(correctCode)) {
    localNumber = digitsOnly.slice(correctCode.length)
  }
  
  // Step 4: Truncate based on regional rules
  // - UAE/Saudi: 9 digits (e.g. 50 123 4567)
  // - India: 10 digits
  // - Others: 8 digits
  const countryDigits: Record<string, number> = {
    '971': 9, '966': 9, '91': 10
  }
  const takeDigits = countryDigits[correctCode] || 8
  localNumber = localNumber.slice(-takeDigits)

  // Step 5: Reconstruct in E.164 format
  const normalized = `+${correctCode}${localNumber}`

  // Step 6: Basic sanity check — must be 10-15 digits total
  const totalDigits = normalized.replace(/\D/g, '').length
  if (totalDigits < 10 || totalDigits > 15) return null

  return normalized
}
