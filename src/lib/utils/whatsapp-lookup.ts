// /lib/utils/whatsapp-lookup.ts
// Twilio Lookup API v2 — checks if a phone number is registered on WhatsApp
// Cost: $0.005 per lookup. Cache result to avoid repeat charges.

export interface WhatsAppLookupResult {
  isOnWhatsApp: boolean;
  lookupError?: string;
}

/**
 * Checks if a phone number is registered on WhatsApp using Twilio Lookup v2.
 */
export async function checkWhatsAppRegistration(
  e164Phone: string, // e.g. +971522707529
  accountSid: string,
  authToken: string
): Promise<WhatsAppLookupResult> {
  try {
    // Ensure number is URL-safe and contains the +
    const formatted = e164Phone.startsWith('+') ? e164Phone : `+${e164Phone}`;
    const encoded = encodeURIComponent(formatted);
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encoded}?Fields=whatsapp`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[WhatsAppLookup] Twilio error: ${err}`);
      return { isOnWhatsApp: false, lookupError: err };
    }

    const data = await response.json();
    const isOnWhatsApp = data?.whatsapp?.registered === true;
    
    return { isOnWhatsApp };
  } catch (e: any) {
    console.error(`[WhatsAppLookup] Fatal error: ${e.message}`);
    return { isOnWhatsApp: false, lookupError: e.message };
  }
}
