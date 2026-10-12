/**
 * Utility: Generator & Sanitizer Company ID Alphanumeric
 * Format Baku: [3 Huruf Inisial]-[4 Angka Acak][3 Digit Urutan Tenant]
 * Contoh Hasil: DND-4829001, BDP-7123002
 */

// Kamus kata terlarang (Profanity, Slang & Kata Kasar ID/EN 3 Huruf)
export const PROFANITY_BLOCKLIST = new Set([
  'ASU', 'BBI', 'TAE', 'KNT', 'PNS', 'JNC', 'WTF', 'SEX', 'BCH', 'FUK', 'GAY',
  'AJG', 'PEK', 'TOL', 'MMK', 'MEM', 'LON', 'MOD', 'BAJ', 'JRK', 'KMR', 'BAP',
  'BEG', 'TIT', 'COK', 'CUK', 'VAG', 'ASS', 'DIK', 'FUC', 'DAM', 'PIS', 'POO',
  'SUK', 'CNT', 'NGR', 'DIE', 'SLT', 'SHT', 'KMP', 'KTL', 'PLQ', 'TTE'
]);

const SAFE_CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'Z'];

/**
 * Ekstraksi 3 huruf singkatan dari nama owner.
 * Mengutamakan konsonan nama (contoh: Dendy -> DND, Budi Pratama -> BDP).
 * Melindungi dari kata kasar via PROFANITY_BLOCKLIST.
 */
export function extractOwnerInitials(ownerName: string): string {
  if (!ownerName || !ownerName.trim()) {
    return generateSafeRandomLetters();
  }

  const cleanLetters = ownerName.toUpperCase().replace(/[^A-Z]/g, '');
  if (!cleanLetters) {
    return generateSafeRandomLetters();
  }

  // 1. Kumpulkan konsonan
  const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
  const consonants = cleanLetters.split('').filter((c) => !vowels.has(c));

  let candidate = '';

  if (consonants.length >= 3) {
    candidate = consonants.slice(0, 3).join('');
  } else {
    // Jika konsonan kurang dari 3, ambil dari huruf nama asli
    candidate = cleanLetters.slice(0, 3);
    // Jika masih kurang dari 3, lengkapi dengan huruf konsonan acak
    while (candidate.length < 3) {
      const padChar = SAFE_CONSONANTS[Math.floor(Math.random() * SAFE_CONSONANTS.length)];
      candidate += padChar;
    }
  }

  // 2. Validasi Profanity Blocklist
  if (PROFANITY_BLOCKLIST.has(candidate)) {
    return generateSafeRandomLetters();
  }

  return candidate;
}

/**
 * Menghasilkan 3 huruf acak yang dijamin bebas kata kasar
 */
export function generateSafeRandomLetters(): string {
  let letters = '';
  let attempts = 0;
  do {
    letters = '';
    for (let i = 0; i < 3; i++) {
      letters += SAFE_CONSONANTS[Math.floor(Math.random() * SAFE_CONSONANTS.length)];
    }
    attempts++;
  } while (PROFANITY_BLOCKLIST.has(letters) && attempts < 10);

  return letters;
}

/**
 * Generate Company ID lengkap sesuai standar:
 * [3 Huruf Inisial]-[4 Angka Acak][3 Digit Urutan Tenant]
 *
 * @param ownerName Nama lengkap owner (misal: "Dendy Aditya")
 * @param sequenceNumber Nomor urut tenant (misal: 1 -> "001")
 * @returns String Company ID (contoh: "DND-4829001")
 */
export function generateCompanyId(ownerName: string, sequenceNumber: number): string {
  const prefix = extractOwnerInitials(ownerName);
  const random4Digits = Math.floor(1000 + Math.random() * 9000); // 1000 - 9999
  const paddedSeq = String(sequenceNumber).padStart(3, '0');

  return `${prefix}-${random4Digits}${paddedSeq}`;
}

/**
 * Normalisasi input kasir saat login/pairing agar toleran:
 * - Huruf kecil/kapital: "dnd-4829001" -> "DND-4829001"
 * - Tanpa strip: "DND4829001" -> "DND-4829001"
 */
export function normalizeCompanyIdInput(rawInput: string): {
  rawTrimmed: string;
  upperInput: string;
  withDash: string;
  variants: string[];
} {
  const rawTrimmed = (rawInput || '').trim();
  const upperInput = rawTrimmed.toUpperCase();

  let withDash = upperInput;
  if (!upperInput.includes('-') && upperInput.length >= 8) {
    withDash = `${upperInput.slice(0, 3)}-${upperInput.slice(3)}`;
  }

  const variants = Array.from(
    new Set([
      upperInput,
      withDash,
      rawTrimmed.toLowerCase(),
      rawTrimmed,
    ])
  ).filter(Boolean);

  return {
    rawTrimmed,
    upperInput,
    withDash,
    variants,
  };
}
