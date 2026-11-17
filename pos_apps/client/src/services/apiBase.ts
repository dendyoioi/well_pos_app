// Well POS - Global API Base Resolver
// Mengarahkan seluruh panggilan /api langsung ke backend Render Singapore (CORS terkonfigurasi)
// untuk mem-bypass Vercel Edge CDN Reverse Proxy (menghemat 99% kuota CDN Vercel).

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  // Auto-detection untuk deployment Vercel / Domain Resmi Well POS:
  // Jika sedang berjalan di domain wellpos.id, beta.wellpos.id, atau *.vercel.app,
  // langsung arahkan seluruh pemanggilan API ke backend Render Singapore
  // tanpa melewati reverse proxy Vercel Edge (mencegah kehabisan kuota 1.000.000 CDN requests).
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.vercel.app') || hostname.endsWith('wellpos.id')) {
      return 'https://wellpos-api-dev.onrender.com';
    }
  }
  // Localhost development fallback (menggunakan Vite proxy localhost:5001)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const base = API_BASE_URL;
    if (base) {
      if (typeof input === 'string') {
        if (input.startsWith('/api')) {
          input = `${base}${input}`;
        }
      } else if (input instanceof URL) {
        if (input.pathname.startsWith('/api')) {
          input = new URL(`${base}${input.pathname}${input.search}`);
        }
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        const urlObj = new URL(input.url, window.location.origin);
        if (urlObj.pathname.startsWith('/api') && urlObj.origin === window.location.origin) {
          input = new Request(`${base}${urlObj.pathname}${urlObj.search}`, input);
        }
      }
    }
    return originalFetch(input, init);
  };
}
