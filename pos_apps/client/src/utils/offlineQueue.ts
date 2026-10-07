/**
 * Utilitas Antrean Transaksi Offline (IndexedDB) — Well POS PWA
 * Menyimpan pesanan kasir lokal saat koneksi internet terputus mendadak
 * dan menyinkronkan data secara otomatis ke server saat internet pulih.
 */

export interface OfflineOrderEntry {
  offlineId: string;
  createdAt: string;
  outletId?: string;
  shiftId?: string;
  cashierName?: string;
  payload: any;
  tempOrder: any;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  retryCount: number;
  lastError?: string;
  syncedAt?: string;
}

const DB_NAME = 'well_pos_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_orders';

/**
 * Inisialisasi koneksi database IndexedDB
 */
export const openOfflineDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB tidak didukung pada browser ini'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'offlineId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('outletId', 'outletId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Menyimpan transaksi baru ke antrean offline lokal
 */
export const saveOfflineOrder = async (order: OfflineOrderEntry): Promise<void> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(order);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

/**
 * Mengambil seluruh pesanan offline yang belum berhasil disinkronkan
 */
export const getPendingOfflineOrders = async (outletId?: string): Promise<OfflineOrderEntry[]> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      let results: OfflineOrderEntry[] = req.result || [];
      // Filter yang masih PENDING atau FAILED
      results = results.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
      if (outletId) {
        results = results.filter((item) => !item.outletId || item.outletId === outletId);
      }
      // Urutkan FIFO berdasarkan waktu pembuatan
      results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * Mengambil ringkasan jumlah antrean offline
 */
export const getOfflineQueueCount = async (outletId?: string): Promise<{ pending: number; total: number }> => {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all: OfflineOrderEntry[] = req.result || [];
        const relevant = outletId ? all.filter((o) => !o.outletId || o.outletId === outletId) : all;
        const pending = relevant.filter((o) => o.status === 'PENDING' || o.status === 'FAILED').length;
        resolve({ pending, total: relevant.length });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { pending: 0, total: 0 };
  }
};

/**
 * Memperbarui status pesanan saat proses sinkronisasi sedang berlangsung
 */
export const markOfflineOrderSyncing = async (offlineId: string): Promise<void> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(offlineId);

    getReq.onsuccess = () => {
      const item: OfflineOrderEntry = getReq.result;
      if (item) {
        item.status = 'SYNCING';
        item.retryCount = (item.retryCount || 0) + 1;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

/**
 * Menandai pesanan berhasil tersinkronkan ke server
 */
export const markOfflineOrderSuccess = async (offlineId: string, serverData?: any): Promise<void> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(offlineId);

    getReq.onsuccess = () => {
      const item: OfflineOrderEntry = getReq.result;
      if (item) {
        item.status = 'SYNCED';
        item.syncedAt = new Date().toISOString();
        if (serverData) {
          item.tempOrder = { ...item.tempOrder, ...serverData };
        }
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

/**
 * Menandai pesanan gagal disinkronkan beserta catatan pesan error
 */
export const markOfflineOrderFailed = async (offlineId: string, errorMsg: string): Promise<void> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(offlineId);

    getReq.onsuccess = () => {
      const item: OfflineOrderEntry = getReq.result;
      if (item) {
        item.status = 'FAILED';
        item.lastError = errorMsg;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

/**
 * Menghapus pesanan yang sudah berhasil disinkronkan untuk membersihkan ruang penyimpanan lokal
 */
export const clearSyncedOfflineOrders = async (): Promise<void> => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: OfflineOrderEntry[] = req.result || [];
      items.forEach((item) => {
        if (item.status === 'SYNCED') {
          store.delete(item.offlineId);
        }
      });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
};
