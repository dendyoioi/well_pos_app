/**
 * Utilitas Deteksi dan Validasi Email Dummy / Disposable (Sekali Pakai)
 * Mencegah pendaftaran fiktif atau bot pada alur SaaS Well POS.
 */

// Daftar domain penyedia email sementara / disposable populer dunia
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'hide.biz.st',
  'mymail.infos.st',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'getairmail.com',
  'dispostable.com',
  'fakemailgenerator.com',
  'fakemail.net',
  'dropmail.me',
  'emailondeck.com',
  'mohmal.com',
  'nada.ltd',
  'getnada.com',
  'inboxes.com',
  'crazymailing.com',
  'tempm.com',
  'burnermail.io',
  'tempail.com',
  'generator.email',
  'mytemp.email',
  'mailnesia.com',
  'maildrop.cc',
  'disposablemail.com',
  'fakeinbox.com',
  'instantemailaddress.com',
  'discard.email',
  'discardmail.com',
  'spambog.com',
  'spambog.de',
  'trash-mail.com',
  'mailcatch.com',
  'mytempmail.com',
  'tempinbox.com',
  'incognitomail.com',
  'anonymbox.com',
  'filzmail.com',
  'boun.cr',
  'byom.de',
  'zetmail.com',
  'mailsac.com',
  'tempmailaddress.com',
  'mailimate.com',
  'maildu.de',
  'deadaddress.com',
  'trbvm.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'einrot.com',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'devnullmail.com',
  'letthemeatspam.com',
  'mailinater.com',
  'suremail.info',
  'zippymail.info',
  'trashymail.com',
  'throwawayemailaddresses.com',
  'tempemail.net',
  'tempmailgen.com',
  'mintemail.com',
  'sofort-mail.de',
  'kasmail.com',
  'spamgourmet.com',
  'mytempemail.com',
  'guerrillamail.de',
  'pokemail.net',
  'spam4.me',
  'fakeemail.net',
  'generator-email.com',
  'fakemail.com',
  'tempmail.net',
  'emailfake.com',
  'crazymail.com',
  'temporarymail.com',
  'mohmal.in',
  'burner.email',
  'tmail.com',
]);

/**
 * Validasi sintaks format email standar RFC 5322 ringkas
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Mengekstrak domain dari alamat email
 */
export function extractEmailDomain(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1].trim() : '';
}

/**
 * Memeriksa apakah suatu email berasal dari domain email sementara (disposable/dummy)
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  // Cek direct match
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // Cek subdomain (misal: test@sub.mailinator.com)
  for (const disposableDomain of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith('.' + disposableDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Validasi menyeluruh alamat email untuk pendaftaran bisnis Well POS
 */
export function validateBusinessEmail(email: string): {
  isValid: boolean;
  cleanEmail: string;
  message?: string;
} {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return {
      isValid: false,
      cleanEmail: '',
      message: 'Alamat email wajib diisi',
    };
  }

  const clean = email.trim().toLowerCase();

  if (clean.length > 254) {
    return {
      isValid: false,
      cleanEmail: clean,
      message: 'Alamat email terlalu panjang (maksimal 254 karakter)',
    };
  }

  if (!EMAIL_REGEX.test(clean)) {
    return {
      isValid: false,
      cleanEmail: clean,
      message: 'Format alamat email tidak valid (contoh: bisnis@gmail.com)',
    };
  }

  if (isDisposableEmail(clean)) {
    return {
      isValid: false,
      cleanEmail: clean,
      message: 'Email sekali pakai / sementara tidak diizinkan. Mohon gunakan email bisnis atau email pribadi aktif Anda.',
    };
  }

  return {
    isValid: true,
    cleanEmail: clean,
  };
}
