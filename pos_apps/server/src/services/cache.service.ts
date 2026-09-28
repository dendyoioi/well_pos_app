export interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private inMemoryStore: Map<string, CacheItem<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  /**
   * Mengambil data dari cache
   */
  async get<T>(key: string): Promise<T | null> {
    const item = this.inMemoryStore.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.inMemoryStore.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.value as T;
  }

  /**
   * Menyimpan data ke dalam cache dengan TTL (detik)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.inMemoryStore.set(key, { value, expiresAt });
    this.stats.sets++;
  }

  /**
   * Menghapus cache berdasarkan key spesifik
   */
  async del(key: string): Promise<void> {
    if (this.inMemoryStore.has(key)) {
      this.inMemoryStore.delete(key);
      this.stats.deletes++;
    }
  }

  /**
   * Menghapus seluruh cache yang diawali prefix tertentu
   */
  async delByPrefix(prefix: string): Promise<number> {
    let deletedCount = 0;
    for (const key of this.inMemoryStore.keys()) {
      if (key.startsWith(prefix)) {
        this.inMemoryStore.delete(key);
        deletedCount++;
        this.stats.deletes++;
      }
    }
    return deletedCount;
  }

  /**
   * Mengambil atau menyetel katalog produk tenant (Cache-Aside Pattern)
   */
  async getCachedProductCatalog<T>(tenantId: string, fetcher: () => Promise<T>, ttlSeconds: number = 60): Promise<{ data: T; fromCache: boolean }> {
    const key = `cache:tenant:${tenantId}:catalog:products`;
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return { data: fresh, fromCache: false };
  }

  /**
   * Invalidate katalog produk tenant (dipanggil saat create/update/delete product)
   */
  async invalidateProductCatalog(tenantId: string): Promise<number> {
    return await this.delByPrefix(`cache:tenant:${tenantId}:catalog`);
  }

  /**
   * Mengambil atau menyetel status lisensi subscription tenant
   */
  async getCachedSubscription<T>(tenantId: string, fetcher: () => Promise<T>, ttlSeconds: number = 120): Promise<{ data: T; fromCache: boolean }> {
    const key = `cache:tenant:${tenantId}:subscription:status`;
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return { data: fresh, fromCache: false };
  }

  /**
   * Invalidate status lisensi subscription tenant
   */
  async invalidateSubscription(tenantId: string): Promise<void> {
    await this.del(`cache:tenant:${tenantId}:subscription:status`);
  }

  /**
   * Membersihkan seluruh isi cache
   */
  clear(): void {
    this.inMemoryStore.clear();
  }

  /**
   * Mengambil statistik performa cache
   */
  getMetrics() {
    return {
      size: this.inMemoryStore.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatePercentage: this.stats.hits + this.stats.misses > 0
        ? Number(((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2))
        : 0,
      totalSets: this.stats.sets,
      totalDeletes: this.stats.deletes,
    };
  }
}

export const cacheService = new CacheService();
