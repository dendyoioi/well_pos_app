/**
 * Well POS — Global Session Lifetime & HTTP 401 Interceptor
 * Mencegah layar data kosong (blank screen) saat token JWT kedaluwarsa (7 hari).
 * Menangkap seluruh kegagalan otentikasi secara terpusat, membersihkan sesi lama,
 * dan memancarkan event ramah pengguna untuk menampilkan modal "Sesi Berakhir".
 */

import { authStorage, platformStorage } from './api';

export interface SessionExpiredEventDetail {
  type: 'merchant' | 'platform';
  message: string;
  expiredAt: string;
}

let lastDispatchedAt = 0;
let isInterceptorInitialized = false;

export function initSessionInterceptor() {
  if (typeof window === 'undefined' || isInterceptorInitialized) return;
  isInterceptorInitialized = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch(input, init);

    // Tangani HTTP 401 Unauthorized
    if (response.status === 401) {
      const urlString =
        typeof input === 'string'
          ? input
          : input instanceof Request
          ? input.url
          : input.toString();

      // Abaikan SEMUA endpoint auth, pre-login, dan validasi latar belakang awal
      // (401 di sini adalah normal saat kredensial salah, token lama invalid, atau pairing kasir)
      const isAuthOrPreLoginEndpoint =
        urlString.includes('/api/auth/') ||
        urlString.includes('/api/platform/auth/') ||
        urlString.includes('/api/health') ||
        urlString.includes('/api/saas/');

      if (!isAuthOrPreLoginEndpoint && urlString.includes('/api/')) {
        const isPlatform = urlString.includes('/api/platform/');

        // KRITIS: HANYA picu jika sebelumnya memang ADA sesi aktif tersimpan di perangkat!
        // Jika pengguna memang belum login (token kosong di localStorage), abaikan 401 dan JANGAN munculkan modal!
        const existingToken = isPlatform ? platformStorage.getToken() : authStorage.getToken();
        if (!existingToken) {
          return response;
        }

        const now = Date.now();
        // Debounce: cegah spam event jika ada banyak request paralel yang sama-sama 401
        if (now - lastDispatchedAt > 3000) {
          lastDispatchedAt = now;

          if (isPlatform) {
            platformStorage.clearSession();
            const detail: SessionExpiredEventDetail = {
              type: 'platform',
              message:
                'Sesi portal Superadmin telah kedaluwarsa setelah 7 hari demi keamanan sistem. Silakan masuk kembali.',
              expiredAt: new Date().toISOString(),
            };
            window.dispatchEvent(new CustomEvent('auth:session_expired', { detail }));
          } else {
            authStorage.clearSession();
            const detail: SessionExpiredEventDetail = {
              type: 'merchant',
              message:
                'Sesi login perangkat kasir / toko Anda telah berakhir demi keamanan data. Silakan masuk kembali.',
              expiredAt: new Date().toISOString(),
            };
            window.dispatchEvent(new CustomEvent('auth:session_expired', { detail }));
          }
        }
      }
    }

    return response;
  };
}
