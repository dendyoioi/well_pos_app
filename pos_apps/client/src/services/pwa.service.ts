/**
 * PWA Service
 * Handles Service Worker registration, install prompt interception,
 * and standalone display-mode detection for desktop & mobile devices.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PwaListener = (state: {
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
}) => void;

class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled: boolean = false;
  private listeners: Set<PwaListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkInstalledStatus();

      // Tangkap event sebelum dialog install native browser
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.notify();
      });

      // Deteksi jika pengguna telah menginstal aplikasi
      window.addEventListener('appinstalled', () => {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notify();
      });

      // Deteksi perubahan display mode (browser vs standalone window)
      window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
        this.checkInstalledStatus();
        this.notify();
      });
    }
  }

  private checkInstalledStatus() {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    this.isInstalled = isStandalone;
  }

  public isIosDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  }

  public getStatus() {
    return {
      isInstallable: !!this.deferredPrompt,
      isInstalled: this.isInstalled,
      isIos: this.isIosDevice(),
    };
  }

  public addListener(listener: PwaListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }

  /**
   * Panggil dialog install native OS / browser
   */
  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) {
      return 'unavailable';
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.isInstalled = true;
      }
      this.deferredPrompt = null;
      this.notify();
      return choice.outcome;
    } catch (err) {
      console.warn('[PWA] Prompt install error:', err);
      return 'dismissed';
    }
  }

  /**
   * Registrasi Service Worker di background
   */
  public registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker terdaftar dengan scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker gagal terdaftar:', err);
          });
      });
    }
  }
}

export const pwaService = new PwaService();
