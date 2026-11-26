/**
 * Utilitas Read-Cache Lokal Terisolasi (IndexedDB) — Well POS PWA
 * Menyimpan salinan baca katalog, outlet, shift aktif, pelanggan, dan daftar bisnis
 * secara terpisah dari Service Worker HTTP cache untuk ketahanan operasional saat offline.
 */

export interface OfflineCacheEntry<T = any> {
  key: string;
  data: T;
  updatedAt: string;
}

const DB_NAME = 'well_pos_offline_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache_entries';

const openCacheDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB tidak didukung pada browser ini'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Menyimpan data cache ke IndexedDB secara fail-silent
 */
export const setOfflineCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const db = await openCacheDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: OfflineCacheEntry<T> = {
        key,
        data,
        updatedAt: new Date().toISOString(),
      };
      const req = store.put(entry);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Fail-silent bila IndexedDB diblokir (mis. private browsing / quota)
  }
};

/**
 * Mengambil entri cache berdasarkan key dari IndexedDB secara fail-silent
 */
export const getOfflineCache = async <T>(key: string): Promise<OfflineCacheEntry<T> | null> => {
  try {
    const db = await openCacheDatabase();
    return await new Promise<OfflineCacheEntry<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve((req.result as OfflineCacheEntry<T>) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
};

/**
 * Menghapus entri cache berdasarkan prefix (atau seluruh cache bila prefix kosong)
 */
export const clearOfflineCacheByPrefix = async (prefix?: string): Promise<void> => {
  try {
    const db = await openCacheDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      if (!prefix) {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } else {
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result || []) as string[];
          for (const key of keys) {
            if (typeof key === 'string' && key.startsWith(prefix)) {
              store.delete(key);
            }
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      }

      tx.oncomplete = () => db.close();
    });
  } catch {
    // Fail-silent bila IndexedDB tidak tersedia
  }
};

/**
 * Memformat ISO timestamp cache menjadi jam lokal ringkas (HH:mm)
 */
export const formatCacheTime = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date
      .toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace('.', ':');
  } catch {
    return '';
  }
};
