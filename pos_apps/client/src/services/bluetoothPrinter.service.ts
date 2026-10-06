/**
 * Web Bluetooth Thermal Printer Service
 * Manages Bluetooth Low Energy (BLE) connection and raw ESC/POS binary transmission
 * for seamless direct 1-click printing on mobile/desktop without browser print dialog.
 */

import { buildReceiptEscPos, buildTestPrintEscPos } from '../utils/escpos';
import type { EscPosOptions } from '../utils/escpos';

export type BluetoothPrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BluetoothPrinterListener {
  (status: BluetoothPrinterStatus, deviceName: string | null, error?: string | null): void;
}

// Known GATT Service UUIDs for popular thermal receipt printers
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Chinese Printers (Goojprt, Panda, MPT-II)
  '0000ae00-0000-1000-8000-00805f9b34fb', // RPP02N / Iware
  '0000af30-0000-1000-8000-00805f9b34fb',
];

class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;
  private status: BluetoothPrinterStatus = 'disconnected';
  private deviceName: string | null = null;
  private lastError: string | null = null;
  private listeners: Set<BluetoothPrinterListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.deviceName = localStorage.getItem('wellpos_bt_device_name');
    }
  }

  /**
   * Cek apakah browser mendukung Web Bluetooth API
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  getStatus(): BluetoothPrinterStatus {
    return this.status;
  }

  getDeviceName(): string | null {
    return this.deviceName;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  addListener(listener: BluetoothPrinterListener): () => void {
    this.listeners.add(listener);
    // Emit immediate current state
    listener(this.status, this.deviceName, this.lastError);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.status, this.deviceName, this.lastError));
  }

  /**
   * Cari dan hubungkan printer Bluetooth melalui dialog native browser
   */
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.status = 'error';
      const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIos) {
        this.lastError = 'Apple (Safari iOS) membatasi Web Bluetooth langsung. Di iPhone, silakan buka aplikasi via browser BLE (seperti aplikasi Bluefy di App Store) atau gunakan perangkat kasir Android/Laptop.';
      } else {
        this.lastError = 'Browser Anda belum mendukung Web Bluetooth API. Gunakan Google Chrome, Microsoft Edge, atau Opera.';
      }
      this.notify();
      throw new Error(this.lastError);
    }

    try {
      this.status = 'connecting';
      this.lastError = null;
      this.notify();

      const navBluetooth = (navigator as any).bluetooth;

      // Request device dengan semua service printer populer
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (!device) {
        throw new Error('Tidak ada perangkat yang dipilih.');
      }

      this.device = device;
      this.deviceName = device.name || 'Printer Bluetooth';
      if (typeof window !== 'undefined') {
        localStorage.setItem('wellpos_bt_device_name', this.deviceName || '');
      }

      // Pasang listener jika koneksi terputus
      device.addEventListener('gattserverdisconnected', () => {
        this.status = 'disconnected';
        this.characteristic = null;
        this.notify();
      });

      // Hubungkan ke GATT Server
      const server = await device.gatt.connect();

      // Cari characteristic yang bisa ditulisi (write / writeWithoutResponse)
      let targetCharacteristic: any = null;

      // 1. Coba cari di Known Services terlebih dahulu
      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch {
          // Lanjut ke service berikutnya
        }
      }

      // 2. Jika belum ketemu, coba scan seluruh primary services yang terekspos
      if (!targetCharacteristic) {
        try {
          const allServices = await server.getPrimaryServices();
          for (const s of allServices) {
            try {
              const chars = await s.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  targetCharacteristic = c;
                  break;
                }
              }
              if (targetCharacteristic) break;
            } catch {
              // Ignore
            }
          }
        } catch {
          // Ignore
        }
      }

      if (!targetCharacteristic) {
        throw new Error('Tidak ditemukan saluran transmisi printer yang cocok pada perangkat ini.');
      }

      this.characteristic = targetCharacteristic;
      this.status = 'connected';
      this.lastError = null;
      this.notify();
      return true;
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message || 'Gagal menghubungkan ke printer Bluetooth.';
      this.notify();
      throw err;
    }
  }

  /**
   * Putuskan koneksi Bluetooth secara manual
   */
  disconnect() {
    try {
      if (this.device && this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Bluetooth disconnect error:', e);
    } finally {
      this.device = null;
      this.characteristic = null;
      this.status = 'disconnected';
      this.notify();
    }
  }

  /**
   * Kirim buffer mentah (Uint8Array) ke printer dengan chunking aman (~100 bytes)
   */
  async printRaw(data: Uint8Array): Promise<void> {
    if (this.status !== 'connected' || !this.characteristic) {
      throw new Error('Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.');
    }

    const CHUNK_SIZE = 100; // Ukuran paket BLE yang aman mencegah buffer overflow
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Delay kecil 15-20ms agar buffer mikrokontroler printer tidak macet
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * Cetak struk transaksi belanja POS langsung via Bluetooth
   */
  async printReceipt(order: any, options: EscPosOptions = {}): Promise<void> {
    const rawBytes = buildReceiptEscPos(order, options);
    await this.printRaw(rawBytes);
  }

  /**
   * Cetak uji coba kertas thermal
   */
  async testPrint(paperSize: '58mm' | '80mm' = '58mm'): Promise<void> {
    const rawBytes = buildTestPrintEscPos(paperSize);
    await this.printRaw(rawBytes);
  }

  /**
   * Kirim sinyal pemicu buka laci kasir (Cash Drawer Kick)
   */
  async kickDrawer(): Promise<void> {
    // Sinyal ESC p 0 25 250
    const drawerSignal = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    await this.printRaw(drawerSignal);
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();
