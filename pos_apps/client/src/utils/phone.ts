/**
 * Utilitas validasi dan formatting nomor WhatsApp Indonesia
 * Format standar: +628...
 * Aturan:
 * - Wajib angka (tidak boleh ada huruf/simbol)
 * - Kode negara: +62
 * - Digit pertama setelah +62: Angka 8 (seluler Indonesia)
 * - Panjang karakter setelah +62: Minimal 9 digit, MAKSIMAL 13 DIGIT.
 */

export const sanitizeNumericOnly = (input: string): string => {
  return input.replace(/\D/g, '');
};

export const formatIndonesianWhatsApp = (input: string): string => {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('62')) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, '');

  if (digits.length > 13) {
    digits = digits.slice(0, 13);
  }

  return `+62${digits}`;
};

export const validateIndonesianWhatsApp = (rawInput: string): { isValid: boolean; message?: string } => {
  if (!rawInput || !rawInput.trim()) {
    return { isValid: false, message: 'Nomor WhatsApp wajib diisi' };
  }

  if (/[^\d\s\-]/.test(rawInput.replace(/^\+/, ''))) {
    return { isValid: false, message: 'Nomor WhatsApp hanya boleh berisi angka (tidak boleh ada huruf/karakter lain)' };
  }

  const digits = rawInput.replace(/\D/g, '');
  let localDigits = digits;

  if (digits.startsWith('62')) {
    localDigits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    localDigits = digits.replace(/^0+/, '');
  }

  if (!localDigits.startsWith('8')) {
    return { isValid: false, message: 'Nomor WhatsApp harus berawalan angka 8 (contoh: 08... atau 628...)' };
  }

  if (localDigits.length < 9) {
    return { isValid: false, message: 'Nomor WhatsApp terlalu pendek (minimal 9 digit setelah +62)' };
  }

  if (localDigits.length > 13) {
    return { isValid: false, message: 'Nomor WhatsApp maksimal 13 karakter setelah +62' };
  }

  return { isValid: true };
};

export const isValidIndonesianWhatsApp = (phone: string): boolean => {
  return validateIndonesianWhatsApp(phone).isValid;
};
