/**
 * Phone Number Validation & Formatting Utility
 * Handles GCC-specific prefix verification to prevent bad data.
 */

export interface PhoneValidationResult {
  isValid: boolean
  formatted?: string
  status: 'wa_ready' | 'bad_data' | 'unreachable' | 'no_email'
}

const GCC_PREFIXES: Record<string, string> = {
  'dubai': '971',
  'abu dhabi': '971',
  'sharjah': '971',
  'ajman': '971',
  'ummal quwain': '971',
  'ras al khaimah': '971',
  'fujairah': '971',
  'riyadh': '966',
  'jeddah': '966',
  'mecca': '966',
  'medina': '966',
  'dammam': '966',
  'dhahran': '966',
  'khobar': '966',
  'kuwait city': '965',
  'kuwait': '965',
  'doha': '974',
  'muscat': '968',
  'manama': '973'
}

/**
 * Validates if a phone number belongs to the correct GCC region based on city.
 * Prevents US-formatted numbers (from bad scrapes) from triggering WhatsApp.
 */
export function validateGCCPhone(phone: string | null | undefined, city: string | null | undefined): PhoneValidationResult {
  if (!phone) return { isValid: false, status: 'unreachable' }
  
  const cleanPhone = phone.replace(/\D/g, '')
  const cleanCity = city?.toLowerCase().trim() || ''
  
  // 1. Identify if city is a known GCC city
  const expectedPrefix = GCC_PREFIXES[cleanCity]
  
  if (!expectedPrefix) {
    // If not a known GCC city, we just check if it has enough digits for a global phone
    return { 
      isValid: cleanPhone.length >= 8, 
      status: cleanPhone.length >= 8 ? 'wa_ready' : 'unreachable',
      formatted: `+${cleanPhone}`
    }
  }

  // 2. Strict GCC Prefix Check
  // US format (starting with 1) for a GCC city is BAD DATA
  if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
    return { isValid: false, status: 'bad_data' }
  }

  // Check if it already has the prefix or is a local number we can prefix
  if (cleanPhone.startsWith(expectedPrefix)) {
    return { isValid: true, status: 'wa_ready', formatted: `+${cleanPhone}` }
  }

  // Case for local numbers (e.g. 05x or 5x in UAE)
  if (cleanPhone.length >= 7 && cleanPhone.length <= 10) {
      // Strip leading zero if present
      const local = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone
      return { 
        isValid: true, 
        status: 'wa_ready', 
        formatted: `+${expectedPrefix}${local}` 
      }
  }

  return { isValid: false, status: 'bad_data' }
}
