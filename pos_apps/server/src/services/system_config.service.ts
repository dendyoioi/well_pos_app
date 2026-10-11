import fs from 'fs';
import path from 'path';

export interface SystemConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  estimatedEndTime: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
}

const DEFAULT_CONFIG: SystemConfig = {
  maintenanceMode: false,
  maintenanceMessage:
    'Sistem Well POS sedang dalam peningkatan dan pemeliharaan berkala untuk meningkatkan stabilitas serta performa layanan. Seluruh operasional kasir dan halaman publik ditangguhkan sementara.',
  estimatedEndTime: null,
  activatedAt: null,
  activatedBy: null,
};

const CONFIG_FILE_PATH = path.resolve(__dirname, '../../data/platform_system_config.json');

class SystemConfigService {
  private configCache: SystemConfig;

  constructor() {
    this.configCache = this.loadConfigFromFile();
  }

  private loadConfigFromFile(): SystemConfig {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
        };
      }
    } catch (err) {
      console.error('[SystemConfigService] Gagal membaca konfigurasi sistem dari file:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfigToFile(config: SystemConfig): void {
    try {
      const dir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SystemConfigService] Gagal menyimpan konfigurasi sistem ke file:', err);
    }
  }

  public getConfig(): SystemConfig {
    return { ...this.configCache };
  }

  public isMaintenanceActive(): boolean {
    return this.configCache.maintenanceMode;
  }

  public updateMaintenance(
    enabled: boolean,
    message?: string,
    estimatedEndTime?: string | null,
    updatedBy?: string
  ): SystemConfig {
    const updated: SystemConfig = {
      ...this.configCache,
      maintenanceMode: enabled,
      maintenanceMessage:
        message?.trim() ||
        this.configCache.maintenanceMessage ||
        DEFAULT_CONFIG.maintenanceMessage,
      estimatedEndTime: estimatedEndTime !== undefined ? estimatedEndTime : this.configCache.estimatedEndTime,
      activatedAt: enabled ? (this.configCache.maintenanceMode ? this.configCache.activatedAt : new Date().toISOString()) : null,
      activatedBy: enabled ? (updatedBy || this.configCache.activatedBy || 'Superadmin') : null,
    };

    if (!enabled) {
      updated.estimatedEndTime = null;
    }

    this.configCache = updated;
    this.saveConfigToFile(updated);
    return { ...this.configCache };
  }
}

export const systemConfigService = new SystemConfigService();
