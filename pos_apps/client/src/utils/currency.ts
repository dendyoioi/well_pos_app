/**
 * Utilitas Resmi Format Mata Uang Rupiah (IDR) & Angka Indonesia
 * Aturan Platform Well POS:
 * - Pemisah ribuan menggunakan titik (.)
 * - Pemisah desimal menggunakan koma (,)
 * - Input interaktif otomatis mengonversi angka murni ke format berpemisah ribuan (cth: saat ketik 1000 berubah menjadi 1.000)
 */

/**
 * Memformat angka atau string angka murni menjadi format ribuan Indonesia dengan titik (cth: 1000 -> 1.000)
 */
export const formatThousands = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '';
  const cleanNumber = String(value).replace(/\D/g, '');
  if (!cleanNumber) return '';
  return cleanNumber.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Memformat angka menjadi format Rupiah lengkap (cth: 50000 -> Rp 50.000)
 */
export const formatRupiah = (value: number | string | undefined | null, withPrefix: boolean = true): string => {
  if (value === undefined || value === null || value === '') return withPrefix ? 'Rp 0' : '0';
  const num = typeof value === 'number' ? Math.round(value) : parseInt(String(value).replace(/\D/g, ''), 10);
  if (isNaN(num)) return withPrefix ? 'Rp 0' : '0';
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return withPrefix ? `Rp ${formatted}` : formatted;
};

/**
 * Membersihkan format string ribuan/rupiah menjadi angka integer murni (cth: "1.000" atau "Rp 1.000" -> 1000)
 */
export const parseFormattedNumber = (formattedStr: string | undefined | null): number => {
  if (!formattedStr) return 0;
  const digits = String(formattedStr).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};
