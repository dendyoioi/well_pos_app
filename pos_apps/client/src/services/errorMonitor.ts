/**
 * Well POS — Client Error Monitoring & Crash Reporter Service
 * Menangkap unhandled exceptions, unhandled promise rejections, dan runtime crashes
 * secara otomatis tanpa ketergantungan library pihak ketiga eksternal.
 */

export interface ClientErrorLog {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
  route: string;
  userAgent: string;
  viewport: string;
  online: boolean;
  context?: any;
}

const STORAGE_KEY = 'wellpos_client_error_logs';
const MAX_STORED_ERRORS = 15;
const errorLogMemory: ClientErrorLog[] = [];

/**
 * Menyimpan error log ke memori dan sessionStorage lokal
 */
export const recordClientError = (
  error: Error | string,
  source = 'manual',
  context?: any
): ClientErrorLog => {
  const errMessage = typeof error === 'string' ? error : error?.message || 'Unknown runtime error';
  const errStack = typeof error === 'string' ? undefined : error?.stack;

  const logEntry: ClientErrorLog = {
    id: `ERR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    message: errMessage,
    stack: errStack,
    source,
    route: window.location.hash || window.location.pathname || '#',
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    context,
  };

  // Tambahkan ke memori
  errorLogMemory.unshift(logEntry);
  if (errorLogMemory.length > MAX_STORED_ERRORS) {
    errorLogMemory.pop();
  }

  // Sinkronkan ke sessionStorage agar bertahan saat reload
  try {
    const rawExisting = sessionStorage.getItem(STORAGE_KEY);
    const existing: ClientErrorLog[] = rawExisting ? JSON.parse(rawExisting) : [];
    existing.unshift(logEntry);
    if (existing.length > MAX_STORED_ERRORS) {
      existing.pop();
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Abaikan jika quota exceeded atau private mode
  }

  // Kirim secara non-blocking ke backend API jika server aktif
  try {
    fetch('/api/health/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => {
      // Silent catch
    });
  } catch {
    // Silent catch
  }

  return logEntry;
};

/**
 * Mengambil riwayat error terkini
 */
export const getClientErrorLogs = (): ClientErrorLog[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fallback ke memori
  }
  return errorLogMemory;
};

/**
 * Menghasilkan teks laporan diagnostik ramah untuk dibagikan via WhatsApp atau evaluasi tech lead
 */
export const generateDiagnosticReport = (error?: Error | null): string => {
  const lastErr = error
    ? {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        route: window.location.hash || '#',
      }
    : getClientErrorLogs()[0] || {
        message: 'Tidak ada rincian stack trace.',
        timestamp: new Date().toISOString(),
        route: window.location.hash || '#',
      };

  return `[LAPORAN KENDALA TEKNIS WELL POS]
Waktu: ${new Date().toLocaleString('id-ID')}
Rute Layar: ${window.location.hash || '#'}
Pesan Error: ${lastErr.message}
Perangkat: ${navigator.userAgent.slice(0, 120)}...
Resolusi Layar: ${window.innerWidth}x${window.innerHeight}
Status Jaringan: ${navigator.onLine ? 'Online' : 'Offline'}

Detail Trace:
${lastErr.stack ? lastErr.stack.split('\n').slice(0, 5).join('\n') : 'N/A'}`;
};

/**
 * Tindakan darurat: Bersihkan seluruh storage lokal dan muat ulang aplikasi secara steril
 */
export const resetAppSessionAndRecover = () => {
  try {
    sessionStorage.clear();
    localStorage.removeItem('wellpos_auth_token');
    localStorage.removeItem('wellpos_user_profile');
  } catch (err) {
    console.warn('Gagal membersihkan cache storage:', err);
  }
  window.location.hash = '#login';
  window.location.reload();
};

/**
 * Inisialisasi pendengar event error global browser
 */
export const initGlobalErrorMonitor = () => {
  if (typeof window === 'undefined') return;

  // 1. Tangkap uncaught script error
  window.addEventListener('error', (event) => {
    console.error('[GlobalErrorMonitor] Uncaught Error:', event.error || event.message);
    recordClientError(
      event.error || event.message || 'Uncaught DOM/Script Error',
      'window.onerror',
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });

  // 2. Tangkap unhandled promise rejections (misal: fetch putus, Bluetooth fail, IndexedDB error)
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalErrorMonitor] Unhandled Promise Rejection:', event.reason);
    const reason = event.reason instanceof Error ? event.reason : String(event.reason);
    recordClientError(reason, 'unhandledrejection');
  });
};
