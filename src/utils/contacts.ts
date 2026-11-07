/**
 * Contact management and Contact Picker API integration for Toko Alma
 * Optimized for Android Chrome Contact Picker & Internal Phonebook
 */

const CONTACTS_STORAGE_KEY = 'ejurnal_alma_contacts';

export interface SavedContact {
  name: string;
  phone: string;
  lastUpdated?: string;
}

export interface PickedDeviceContact {
  name: string;
  phone: string;
  allPhones: string[];
  cancelled?: boolean;
  unsupported?: boolean;
  error?: string;
}

/**
 * Get all stored contacts mapping (Name -> Phone Number)
 */
export function getStoredContacts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load contacts from storage:', e);
  }
  return {};
}

/**
 * Save or update phone number for a customer/penitip name
 */
export function saveContactPhone(name: string, phone: string): void {
  if (!name || !name.trim()) return;
  try {
    const trimmedName = name.trim();
    const cleanedPhone = phone ? formatPhoneNumber(phone) : '';
    const contacts = getStoredContacts();
    if (cleanedPhone) {
      contacts[trimmedName] = cleanedPhone;
    } else {
      delete contacts[trimmedName];
    }
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.error('Failed to save contact:', e);
  }
}

/**
 * Get phone number for a customer/penitip name with fuzzy/case-insensitive matching
 */
export function getPhoneForName(name: string): string {
  if (!name || !name.trim()) return '';
  const contacts = getStoredContacts();
  const trimmed = name.trim();
  if (contacts[trimmed]) return contacts[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(contacts)) {
    if (key.trim().toLowerCase() === lower && val) {
      return val;
    }
  }
  return '';
}

/**
 * Clean phone number into standard local Indonesian format (08xxxxxxxxxx) or valid digits.
 * Solves common Android contact format anomalies:
 * - "+62 812-3456-7890" -> "081234567890"
 * - "6281234567890" -> "081234567890"
 * - "+62 0812..." -> "0812..."
 * - "620812..." -> "0812..."
 * - "0062812..." -> "0812..."
 * - "81234567890" -> "081234567890"
 * - Strips invisible unicode characters (LRM, ZWSP, non-breaking space)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Strip hidden unicode marks from mobile address books
  let cleaned = String(phone)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0\u2010\u2011\u2012\u2013\u2014\u2212]/g, '')
    .trim();

  // Keep only digits and '+'
  cleaned = cleaned.replace(/[^0-9+]/g, '');

  // Handle various Indonesian international prefixes
  if (cleaned.startsWith('+6208')) {
    cleaned = '08' + cleaned.slice(5);
  } else if (cleaned.startsWith('+628')) {
    cleaned = '08' + cleaned.slice(4);
  } else if (cleaned.startsWith('+62')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('006208')) {
    cleaned = '08' + cleaned.slice(6);
  } else if (cleaned.startsWith('00628')) {
    cleaned = '08' + cleaned.slice(5);
  } else if (cleaned.startsWith('0062')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('6208')) {
    cleaned = '08' + cleaned.slice(4);
  } else if (cleaned.startsWith('628')) {
    cleaned = '08' + cleaned.slice(3);
  } else if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Format phone number specifically for WhatsApp API URLs (https://wa.me/628xxxxxxxxxx).
 * Always converts 08... or 8... to 628...
 */
export function toWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  const local = formatPhoneNumber(phone);
  const digits = local.replace(/[^0-9]/g, '');
  if (digits.startsWith('08')) {
    return '628' + digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('8')) {
    return '628' + digits.slice(1);
  }
  if (digits.startsWith('628')) {
    return digits;
  }
  return digits;
}

/**
 * Check if phone number is likely an Indonesian cellular/mobile WhatsApp number (08xx or 628xx)
 */
export function isLikelyMobileNumber(phone: string): boolean {
  if (!phone) return false;
  const f = formatPhoneNumber(phone);
  // Indonesian mobile numbers start with 08, followed by 1-9, total 10 to 14 digits
  return /^08[1-9][0-9]{7,11}$/.test(f);
}

/**
 * Clean contact display name (remove emojis or excessive parenthetical annotations if needed)
 */
export function cleanContactName(name: string): string {
  if (!name) return '';
  return name.trim();
}

/**
 * Check if the browser supports the W3C Contact Picker API (Chrome Android)
 */
export function isContactPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window &&
    typeof (navigator as any).contacts?.select === 'function'
  );
}

/**
 * Check if app is embedded in an iframe (which can restrict native phone permissions)
 */
export function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Open native phone contact picker if supported by the device.
 * Intelligently prioritizes mobile/cell numbers over landlines.
 * Returns PickedDeviceContact or null.
 */
export async function pickContactFromDevice(): Promise<PickedDeviceContact | null> {
  if (!isContactPickerSupported()) {
    return null;
  }

  // Inside iframe, calling navigator.contacts.select throws SecurityError per W3C specification
  if (isInsideIframe()) {
    return {
      name: '',
      phone: '',
      allPhones: [],
      unsupported: true,
      error: 'iframe_blocked',
    };
  }

  try {
    // Check supported properties if available
    let props = ['name', 'tel'];
    if (typeof (navigator as any).contacts.getProperties === 'function') {
      try {
        const availableProps = await (navigator as any).contacts.getProperties();
        if (Array.isArray(availableProps)) {
          props = ['name', 'tel'].filter((p) => availableProps.includes(p));
          if (!props.includes('tel')) {
            props = ['tel'];
          }
        }
      } catch {
        props = ['name', 'tel'];
      }
    }

    const opts = { multiple: false };
    const contacts = await (navigator as any).contacts.select(props, opts);

    // User cancelled or selected nothing
    if (!contacts || contacts.length === 0) {
      return {
        name: '',
        phone: '',
        allPhones: [],
        cancelled: true,
      };
    }

    const c = contacts[0];

    // Extract name
    let chosenName = '';
    if (Array.isArray(c.name) && c.name.length > 0) {
      chosenName = String(c.name[0] || '').trim();
    } else if (typeof c.name === 'string') {
      chosenName = c.name.trim();
    }

    // Extract all phone numbers
    const rawTelList: string[] = Array.isArray(c.tel) ? c.tel : (c.tel ? [c.tel] : []);
    const cleanedPhones: string[] = [];

    for (const raw of rawTelList) {
      const formatted = formatPhoneNumber(String(raw));
      if (formatted && formatted.length >= 7 && !cleanedPhones.includes(formatted)) {
        cleanedPhones.push(formatted);
      }
    }

    // Sort phone numbers: mobile numbers (08xx) FIRST, followed by other numbers
    cleanedPhones.sort((a, b) => {
      const aMobile = isLikelyMobileNumber(a) ? 1 : 0;
      const bMobile = isLikelyMobileNumber(b) ? 1 : 0;
      return bMobile - aMobile;
    });

    const chosenPhone = cleanedPhones.length > 0 ? cleanedPhones[0] : '';

    return {
      name: chosenName,
      phone: chosenPhone,
      allPhones: cleanedPhones,
    };
  } catch (err: any) {
    // User cancelled or aborted
    if (err?.name === 'AbortError' || err?.name === 'TypeError') {
      return {
        name: '',
        phone: '',
        allPhones: [],
        cancelled: true,
      };
    }

    console.warn('Contact picker notice:', err);
    return {
      name: '',
      phone: '',
      allPhones: [],
      error: err?.message || 'Gagal mengakses kontak',
    };
  }
}

/**
 * Decode quoted-printable string (common in Android vCard exports)
 */
function decodeQuotedPrintable(str: string): string {
  try {
    const unescaped = str.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    // Try decoding UTF-8 bytes if needed
    try {
      return decodeURIComponent(escape(unescaped));
    } catch {
      return unescaped;
    }
  } catch {
    return str;
  }
}

/**
 * Parse standard vCard / .vcf contact files exported from Android internal Contacts app.
 * Robust against quoted-printable, UTF-8, multi-line folding, and multiple TEL fields.
 */
export function parseVcfContacts(vcfContent: string): Array<{ name: string; phone: string }> {
  const results: Array<{ name: string; phone: string }> = [];
  if (!vcfContent) return results;

  // Unfold lines wrapped according to RFC 6350 (starts with space or tab)
  const unfolded = vcfContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const cards = unfolded.split(/BEGIN:VCARD/i);

  for (const card of cards) {
    if (!card.trim()) continue;
    let name = '';
    const phoneCandidates: Array<{ number: string; isCell: boolean }> = [];

    // Parse FN (Formatted Name)
    const fnMatch = card.match(/FN(?:;[^:]*)?:([^\r\n]+)/i);
    if (fnMatch) {
      let rawName = fnMatch[1].trim();
      if (/ENCODING=QUOTED-PRINTABLE/i.test(card) || rawName.includes('=')) {
        rawName = decodeQuotedPrintable(rawName);
      }
      name = rawName.replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
    } else {
      const nMatch = card.match(/N(?:;[^:]*)?:([^\r\n]+)/i);
      if (nMatch) {
        let rawName = nMatch[1].trim();
        if (/ENCODING=QUOTED-PRINTABLE/i.test(card) || rawName.includes('=')) {
          rawName = decodeQuotedPrintable(rawName);
        }
        const parts = rawName
          .split(';')
          .map((p) => p.replace(/\\,/g, ',').replace(/\\;/g, ';').trim())
          .filter(Boolean);
        name = parts.reverse().join(' ');
      }
    }

    // Parse all TEL entries
    const telRegex = /TEL(?:;([^:]*))?:([^\r\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = telRegex.exec(card)) !== null) {
      const typeParams = (match[1] || '').toUpperCase();
      const rawNum = match[2].trim();
      const formatted = formatPhoneNumber(rawNum);
      if (formatted && formatted.length >= 7) {
        const isCell =
          typeParams.includes('CELL') ||
          typeParams.includes('MOBILE') ||
          typeParams.includes('PREF') ||
          isLikelyMobileNumber(formatted);
        phoneCandidates.push({ number: formatted, isCell });
      }
    }

    // Pick best mobile phone
    phoneCandidates.sort((a, b) => {
      const aScore = (a.isCell ? 2 : 0) + (isLikelyMobileNumber(a.number) ? 1 : 0);
      const bScore = (b.isCell ? 2 : 0) + (isLikelyMobileNumber(b.number) ? 1 : 0);
      return bScore - aScore;
    });

    const chosenPhone = phoneCandidates.length > 0 ? phoneCandidates[0].number : '';

    if (name && chosenPhone) {
      results.push({ name, phone: chosenPhone });
    }
  }

  return results;
}

/**
 * Bulk save contacts into stored phonebook
 */
export function saveBulkContacts(contactsList: Array<{ name: string; phone: string }>): number {
  const current = getStoredContacts();
  let count = 0;
  for (const c of contactsList) {
    if (c.name && c.phone) {
      current[c.name.trim()] = formatPhoneNumber(c.phone);
      count++;
    }
  }
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error(e);
  }
  return count;
}
