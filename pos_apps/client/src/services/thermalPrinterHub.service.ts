/**
 * Unified Hardware Thermal Printer Hub Service
 * Manages Bluetooth Low Energy (BLE), WebUSB, and Browser Iframe Fallback.
 * Provides 1-click direct receipt printing, auto-print on checkout,
 * and 24V Cash Drawer kick pulses (ESC p 0 25 250).
 */

import { buildReceiptEscPos, buildTestPrintEscPos, buildXZReportEscPos } from '../utils/escpos';
import type { EscPosOptions } from '../utils/escpos';
import { printElementViaThermalIframe } from '../utils/thermalPrinter';

export type PrinterConnectionType = 'bluetooth' | 'usb' | 'system';
export type PrinterHubStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrinterHubState {
  connectionType: PrinterConnectionType;
  status: PrinterHubStatus;
  deviceName: string | null;
  paperSize: '58mm' | '80mm';
  autoPrintEnabled: boolean;
  drawerKickEnabled: boolean;
  lastError: string | null;
}

export interface PrinterHubListener {
  (state: PrinterHubState): void;
}

// Known GATT Service UUIDs for popular thermal receipt printers
const KNOWN_BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Chinese Printers (Goojprt, Panda, MPT-II)
  '0000ae00-0000-1000-8000-00805f9b34fb', // RPP02N / Iware
  '0000af30-0000-1000-8000-00805f9b34fb',
];

class ThermalPrinterHubService {
  // Bluetooth state
  private btDevice: any = null;
  private btCharacteristic: any = null;

  // WebUSB state
  private usbDevice: any = null;
  private usbInterfaceNumber: number | null = null;
  private usbEndpointNumber: number | null = null;

  // Core state
  private state: PrinterHubState = {
    connectionType: 'system',
    status: 'disconnected',
    deviceName: null,
    paperSize: '58mm',
    autoPrintEnabled: false,
    drawerKickEnabled: true,
    lastError: null,
  };

  private listeners: Set<PrinterHubListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedType = localStorage.getItem('wellpos_printer_type') as PrinterConnectionType | null;
      const savedName = localStorage.getItem('wellpos_printer_name');
      const savedPaperSize = localStorage.getItem('wellpos_printer_paper_size') as '58mm' | '80mm' | null;
      const savedAutoPrint = localStorage.getItem('wellpos_autoprint_enabled');
      const savedDrawerKick = localStorage.getItem('wellpos_drawer_kick_enabled');

      this.state.connectionType = savedType || 'system';
      this.state.deviceName = savedName || null;
      if (savedPaperSize) this.state.paperSize = savedPaperSize;
      if (savedAutoPrint !== null) this.state.autoPrintEnabled = savedAutoPrint === 'true';
      if (savedDrawerKick !== null) this.state.drawerKickEnabled = savedDrawerKick !== 'false';
    }
  }

  isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  getState(): PrinterHubState {
    return { ...this.state };
  }

  addListener(listener: PrinterHubListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => fn(currentState));
  }

  private savePreferences() {
    if (typeof window === 'undefined') return;
    localStorage.setItem('wellpos_printer_type', this.state.connectionType);
    localStorage.setItem('wellpos_printer_name', this.state.deviceName || '');
    localStorage.setItem('wellpos_printer_paper_size', this.state.paperSize);
    localStorage.setItem('wellpos_autoprint_enabled', String(this.state.autoPrintEnabled));
    localStorage.setItem('wellpos_drawer_kick_enabled', String(this.state.drawerKickEnabled));
  }

  setPaperSize(size: '58mm' | '80mm') {
    this.state.paperSize = size;
    this.savePreferences();
    this.notify();
  }

  setAutoPrint(enabled: boolean) {
    this.state.autoPrintEnabled = enabled;
    this.savePreferences();
    this.notify();
  }

  setDrawerKick(enabled: boolean) {
    this.state.drawerKickEnabled = enabled;
    this.savePreferences();
    this.notify();
  }

  /**
   * Hubungkan printer via Web Bluetooth (BLE)
   */
  async connectBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
      const errMsg = isIos
        ? 'Apple (Safari iOS) membatasi Web Bluetooth langsung. Buka aplikasi via browser Bluefy di iOS atau gunakan perangkat Android/Laptop.'
        : 'Browser Anda belum mendukung Web Bluetooth API. Gunakan Chrome atau Edge.';
      this.state.lastError = errMsg;
      this.state.status = 'error';
      this.notify();
      throw new Error(errMsg);
    }

    try {
      this.state.status = 'connecting';
      this.state.lastError = null;
      this.notify();

      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_BT_SERVICES,
      });

      if (!device) {
        throw new Error('Tidak ada perangkat Bluetooth yang dipilih.');
      }

      this.btDevice = device;
      const devName = device.name || 'Printer Bluetooth';
      this.state.deviceName = devName;

      device.addEventListener('gattserverdisconnected', () => {
        this.btCharacteristic = null;
        this.state.status = 'disconnected';
        this.notify();
      });

      const server = await device.gatt.connect();

      // Scan characteristics for writable endpoint
      let targetCharacteristic: any = null;

      // 1. Check known printer services first
      for (const serviceUuid of KNOWN_BT_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              targetCharacteristic = c;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch {
          // Continue to next service
        }
      }

      // 2. Scan all services fallback
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
        throw new Error('Tidak ditemukan saluran transmisi ESC/POS yang cocok pada printer Bluetooth ini.');
      }

      this.btCharacteristic = targetCharacteristic;
      this.state.connectionType = 'bluetooth';
      this.state.status = 'connected';
      this.state.lastError = null;
      this.savePreferences();
      this.notify();
      return true;
    } catch (err: any) {
      this.state.status = 'error';
      this.state.lastError = err.message || 'Gagal menghubungkan ke printer Bluetooth.';
      this.notify();
      throw err;
    }
  }

  /**
   * Hubungkan printer thermal via WebUSB (Kabel USB)
   */
  async connectUsb(): Promise<boolean> {
    if (!this.isUsbSupported()) {
      const errMsg = 'Browser ini belum mendukung WebUSB. Gunakan Google Chrome, Microsoft Edge, atau Opera pada Laptop/PC/Android.';
      this.state.lastError = errMsg;
      this.state.status = 'error';
      this.notify();
      throw new Error(errMsg);
    }

    try {
      this.state.status = 'connecting';
      this.state.lastError = null;
      this.notify();

      const navUsb = (navigator as any).usb;
      const device = await navUsb.requestDevice({ filters: [] });

      if (!device) {
        throw new Error('Tidak ada perangkat USB yang dipilih.');
      }

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Cari interface dan bulk OUT endpoint
      let matchedInterface: any = null;
      let matchedEndpointNumber: number | null = null;

      for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')) {
              matchedInterface = iface;
              matchedEndpointNumber = ep.endpointNumber;
              break;
            }
          }
          if (matchedEndpointNumber !== null) break;
        }
        if (matchedEndpointNumber !== null) break;
      }

      if (!matchedInterface || matchedEndpointNumber === null) {
        await device.close();
        throw new Error('Perangkat USB yang dipilih tidak memiliki saluran kirim data printer (Bulk OUT Endpoint).');
      }

      await device.claimInterface(matchedInterface.interfaceNumber);

      this.usbDevice = device;
      this.usbInterfaceNumber = matchedInterface.interfaceNumber;
      this.usbEndpointNumber = matchedEndpointNumber;

      const devName = device.productName || device.manufacturerName || 'Printer USB Thermal';
      this.state.deviceName = devName;
      this.state.connectionType = 'usb';
      this.state.status = 'connected';
      this.state.lastError = null;
      this.savePreferences();
      this.notify();
      return true;
    } catch (err: any) {
      this.state.status = 'error';
      this.state.lastError = err.message || 'Gagal menghubungkan printer kabel USB.';
      this.notify();
      throw err;
    }
  }

  /**
   * Putuskan koneksi aktif
   */
  disconnect() {
    try {
      if (this.state.connectionType === 'bluetooth' && this.btDevice?.gatt?.connected) {
        this.btDevice.gatt.disconnect();
      } else if (this.state.connectionType === 'usb' && this.usbDevice?.opened) {
        if (this.usbInterfaceNumber !== null) {
          this.usbDevice.releaseInterface(this.usbInterfaceNumber).catch(() => {});
        }
        this.usbDevice.close().catch(() => {});
      }
    } catch (e) {
      console.warn('Printer disconnect error:', e);
    } finally {
      this.btDevice = null;
      this.btCharacteristic = null;
      this.usbDevice = null;
      this.usbInterfaceNumber = null;
      this.usbEndpointNumber = null;
      this.state.status = 'disconnected';
      this.notify();
    }
  }

  /**
   * Kirim buffer mentah ESC/POS (Uint8Array) ke perangkat aktif
   */
  async printRaw(data: Uint8Array): Promise<void> {
    if (this.state.status !== 'connected') {
      throw new Error('Printer hardware belum terhubung.');
    }

    // 1. Mode Bluetooth BLE
    if (this.state.connectionType === 'bluetooth') {
      if (!this.btCharacteristic) {
        throw new Error('Saluran transmisi Bluetooth tidak aktif.');
      }
      const CHUNK_SIZE = 100;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        if (this.btCharacteristic.writeValueWithoutResponse) {
          await this.btCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.btCharacteristic.writeValue(chunk);
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      return;
    }

    // 2. Mode WebUSB
    if (this.state.connectionType === 'usb') {
      if (!this.usbDevice || !this.usbDevice.opened || this.usbEndpointNumber === null) {
        throw new Error('Koneksi USB printer tidak aktif atau terputus.');
      }
      await this.usbDevice.transferOut(this.usbEndpointNumber, data);
      return;
    }

    throw new Error('Tipe koneksi printer tidak didukung untuk pengiriman data mentah.');
  }

  /**
   * Cetak struk pesanan (Direct ESC/POS atau Dialog Iframe Fallback)
   */
  async printReceipt(
    order: any,
    options: EscPosOptions = {}
  ): Promise<{ success: boolean; mode: 'bluetooth' | 'usb' | 'system'; error?: string }> {
    const paperSize = options.paperSize || this.state.paperSize;
    const isHardwareConnected = this.state.status === 'connected';

    if (isHardwareConnected && (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')) {
      try {
        const rawBytes = buildReceiptEscPos(order, {
          ...options,
          paperSize,
        });

        // Kirim sinyal laci kasir jika pembayaran tunai dan drawer kick aktif
        const hasCash = order.payments?.some((p: any) => (p.method || p.paymentMethod) === 'CASH');
        if (hasCash && this.state.drawerKickEnabled) {
          await this.kickCashDrawer().catch(() => {});
        }

        await this.printRaw(rawBytes);
        return { success: true, mode: this.state.connectionType };
      } catch (err: any) {
        console.warn('Hardware print failed, falling back to iframe print:', err);
        // Fallback to browser iframe print
        printElementViaThermalIframe('thermal-receipt-content', { paperWidth: paperSize });
        return { success: true, mode: 'system', error: err.message };
      }
    }

    // Default Fallback: Cetak via browser print dialog yang terisolasi di iframe
    printElementViaThermalIframe('thermal-receipt-content', { paperWidth: paperSize });
    return { success: true, mode: 'system' };
  }

  /**
   * Cetak Laporan Rekapitulasi Murni X-Report / Z-Report
   * (Zero transaction list on slip - Kebijakan Rule 13)
   */
  async printXZReport(
    reportData: any,
    type: 'X' | 'Z',
    options: EscPosOptions = {}
  ): Promise<{ success: boolean; mode: 'bluetooth' | 'usb' | 'system' }> {
    const paperSize = options.paperSize || this.state.paperSize;
    const isHardwareConnected = this.state.status === 'connected';

    if (isHardwareConnected && (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')) {
      try {
        const rawBytes = buildXZReportEscPos(reportData, type, { ...options, paperSize });
        await this.printRaw(rawBytes);
        return { success: true, mode: this.state.connectionType };
      } catch (err) {
        console.warn('Hardware X/Z report print failed, falling back to iframe:', err);
      }
    }

    // Fallback: cetak elemen X/Z report lewat iframe
    const elementId = type === 'X' ? 'x-report-printable' : 'z-report-printable';
    printElementViaThermalIframe(elementId, {
      paperWidth: paperSize,
      title: `${type}-Report Kasir`,
    });
    return { success: true, mode: 'system' };
  }

  /**
   * Uji coba cetak struk thermal pendek
   */
  async testPrint(paperSize?: '58mm' | '80mm'): Promise<void> {
    const size = paperSize || this.state.paperSize;
    const label = this.state.connectionType === 'usb' ? 'Kabel USB' : 'Bluetooth';
    const rawBytes = buildTestPrintEscPos(size, `${label} (${this.state.deviceName || 'Thermal'})`);
    await this.printRaw(rawBytes);
  }

  /**
   * Kirim sinyal pemicu buka laci kasir (ESC p 0 25 250)
   */
  async kickCashDrawer(): Promise<void> {
    const drawerSignal = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    await this.printRaw(drawerSignal);
  }
}

export const thermalPrinterHub = new ThermalPrinterHubService();
