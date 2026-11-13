/**
 * Screen Wake Lock Service
 * Keeps cashier mobile / tablet screen awake while in POS view.
 * Prevents mobile OS from locking the screen and severing Bluetooth GATT connection.
 */

class ScreenWakeLockService {
  private sentinel: any = null;
  private isRequested: boolean = false;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async requestWakeLock(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      this.isRequested = true;
      if (!this.sentinel || this.sentinel.released) {
        this.sentinel = await (navigator as any).wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
          // Re-acquire if app was backgrounded and is now visible again
          if (this.isRequested && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            this.requestWakeLock().catch(() => {});
          }
        });
        console.log('[ScreenWakeLock] Screen wake lock acquired. Screen will stay awake for cashier.');
      }
      return true;
    } catch (err) {
      console.warn('[ScreenWakeLock] Failed to acquire wake lock:', err);
      return false;
    }
  }

  releaseWakeLock() {
    this.isRequested = false;
    if (this.sentinel) {
      this.sentinel.release().catch(() => {});
      this.sentinel = null;
      console.log('[ScreenWakeLock] Screen wake lock released.');
    }
  }
}

export const screenWakeLock = new ScreenWakeLockService();
