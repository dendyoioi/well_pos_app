/**
 * Utilitas validasi dan auto-formatting nomor telepon WhatsApp Indonesia
 * Format standar: +628... (Kode negara +62 menggantikan angka 0)
 * Digit lokal di belakang +62 biasanya 9 s.d. 12 digit (diawali angka 8).
 */
export const formatIndonesianWhatsApp = (input: string): string => {
  if (!input) return '';

  // Hapus semua karakter non-digit
  let digits = input.replace(/\D/g, '');

  if (!digits) return '';

  // Jika diawali 62, ambil bagian setelah 62
  if (digits.startsWith('62')) {
    digits = digits.slice(2);
  }

  // Buang semua awalan 0 berulang (misal 0812... -> 812..., atau user ketik 0 setelah +62)
  digits = digits.replace(/^0+/, '');

  // Batasi digit lokal setelah +62: maksimal 12 digit (total panjang +628... adalah 13-14 char)
  if (digits.length > 12) {
    digits = digits.slice(0, 12);
  }

  // Jika tidak ada digit tersisa (misal user hanya ketik '0' atau '+'), kembalikan '+62'
  if (!digits) {
    return '+62';
  }

  return `+62${digits}`;
};

export const isValidIndonesianWhatsApp = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  // Harus diawali 628, minimal 11 digit total (misal +62812345678), maksimal 14 digit
  return digits.startsWith('628') && digits.length >= 11 && digits.length <= 14;
};
