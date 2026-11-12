/**
 * Unified Hardware Thermal Printer Hub Service
 * Manages Bluetooth Low Energy (BLE), WebUSB, and Browser Iframe Fallback.
 * Provides Dual-Printer Support:
 *   1. Primary: Receipt Printer (ESC/POS 58mm / 80mm) with Cash Drawer Kick Pulse
 *   2. Secondary: Cup Label Sticker Printer (TSPL / ESC/POS Label 40x30mm, 50x30mm) for F&B Coffee Shops
 */

import { buildReceiptEscPos, buildTestPrintEscPos, buildXZReportEscPos } from '../utils/escpos';
import type { EscPosOptions } from '../utils/escpos';
import { printElementViaThermalIframe } from '../utils/thermalPrinter';
import {
  buildCupLabelsTspl,
  buildCupLabelsEscPos,
  buildTestCupLabelTspl,
  getCupItemsFromOrder,
  type CupItemDetail,
} from '../utils/cupLabel';

export type PrinterConnectionType = 'bluetooth' | 'usb' | 'system';
export type LabelPrinterConnectionType = 'bluetooth' | 'usb' | 'none';
export type PrinterHubStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LabelPrinterState {
  connectionType: LabelPrinterConnectionType;
  status: PrinterHubStatus;
  deviceName: string | null;
  paperSize: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
  protocol: 'tspl' | 'escpos';
  lastError: string | null;
}

export interface PrinterHubState {
  // Receipt Printer (Primary)
  connectionType: PrinterConnectionType;
  status: PrinterHubStatus;
  deviceName: string | null;
  paperSize: '58mm' | '80mm';
  autoPrintEnabled: boolean;
  drawerKickEnabled: boolean;
  lastError: string | null;

  // Cup Label Sticker Printer (Secondary - F&B Barista)
  labelPrinter: LabelPrinterState;
}

export interface PrinterHubListener {
  (state: PrinterHubState): void;
}

// Known GATT Service UUIDs for popular thermal receipt & label printers
const KNOWN_BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Chinese Printers (Goojprt, Panda, MPT-II, Xprinter Label)
  '0000ae00-0000-1000-8000-00805f9b34fb', // RPP02N / Iware
  '0000af30-0000-1000-8000-00805f9b34fb',
];

class ThermalPrinterHubService {
  // Primary (Receipt) Bluetooth state
  private btDevice: any = null;
  private btCharacteristic: any = null;

  // Primary (Receipt) WebUSB state
  private usbDevice: any = null;
  private usbInterfaceNumber: number | null = null;
  private usbEndpointNumber: number | null = null;

  // Secondary (Cup Label) Bluetooth state
  private labelBtDevice: any = null;
  private labelBtCharacteristic: any = null;

  // Secondary (Cup Label) WebUSB state
  private labelUsbDevice: any = null;
  private labelUsbInterfaceNumber: number | null = null;
  private labelUsbEndpointNumber: number | null = null;

  // Heartbeat Timer untuk Bluetooth Low Energy (Anti-Sleep Ping)
  private btHeartbeatTimer: any = null;

  // Core state
  private state: PrinterHubState = {
    // Primary
    connectionType: 'system',
    status: 'disconnected',
    deviceName: null,
    paperSize: '58mm',
    autoPrintEnabled: false,
    drawerKickEnabled: true,
    lastError: null,

    // Secondary (Cup Label)
    labelPrinter: {
      connectionType: 'none',
      status: 'disconnected',
      deviceName: null,
      paperSize: '40x30mm',
      protocol: 'tspl',
      lastError: null,
    },
  };

  private listeners: Set<PrinterHubListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Primary preferences
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

      // Secondary (Label) preferences
      const savedLabelType = localStorage.getItem('wellpos_label_printer_type') as LabelPrinterConnectionType | null;
      const savedLabelName = localStorage.getItem('wellpos_label_printer_name');
      const savedLabelPaper = localStorage.getItem('wellpos_label_paper_size') as '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm' | null;
      const savedLabelProto = localStorage.getItem('wellpos_label_protocol') as 'tspl' | 'escpos' | null;

      if (savedLabelType) this.state.labelPrinter.connectionType = savedLabelType;
      if (savedLabelName) this.state.labelPrinter.deviceName = savedLabelName;
      if (savedLabelPaper) this.state.labelPrinter.paperSize = savedLabelPaper;
      if (savedLabelProto) this.state.labelPrinter.protocol = savedLabelProto;

      // Otomatis pulihkan koneksi saat layar/tab kasir kembali aktif
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            if (
              this.state.status !== 'connected' &&
              (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')
            ) {
              this.tryAutoReconnect().catch(() => {});
            }
          }
        });
      }
    }
  }

  isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  getState(): PrinterHubState {
    return {
      ...this.state,
      labelPrinter: { ...this.state.labelPrinter },
    };
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

    // Secondary preferences
    localStorage.setItem('wellpos_label_printer_type', this.state.labelPrinter.connectionType);
    localStorage.setItem('wellpos_label_printer_name', this.state.labelPrinter.deviceName || '');
    localStorage.setItem('wellpos_label_paper_size', this.state.labelPrinter.paperSize);
    localStorage.setItem('wellpos_label_protocol', this.state.labelPrinter.protocol);
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

  // Label configuration setters
  setLabelPaperSize(size: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm') {
    this.state.labelPrinter.paperSize = size;
    this.savePreferences();
    this.notify();
  }

  setLabelProtocol(protocol: 'tspl' | 'escpos') {
    this.state.labelPrinter.protocol = protocol;
    this.savePreferences();
    this.notify();
  }

  // =========================================================================
  // 1. PRIMARY PRINTER: RECEIPT (STRUK KASIR)
  // =========================================================================

  /**
   * Heartbeat berkala (Anti-Sleep BLE): Kirim pulse status query setiap 35 detik
   * agar modul Bluetooth printer (Blueprint ECO 58D, dsb.) tidak sleep / memutus koneksi.
   */
  private startBtHeartbeat() {
    this.stopBtHeartbeat();
    if (typeof window === 'undefined') return;

    this.btHeartbeatTimer = setInterval(async () => {
      if (this.state.status === 'connected' && this.state.connectionType === 'bluetooth' && this.btCharacteristic) {
        try {
          // ESC/POS DLE EOT 1 status query (0x10, 0x04, 0x01): benign query, zero paper movement, keeps BLE GATT link alive
          const pingBytes = new Uint8Array([0x10, 0x04, 0x01]);
          if (typeof this.btCharacteristic.writeValueWithoutResponse === 'function') {
            await this.btCharacteristic.writeValueWithoutResponse(pingBytes);
          } else {
            await this.btCharacteristic.writeValue(pingBytes);
          }
        } catch (e) {
          console.warn('[PrinterHub] BT Heartbeat ping error (link may have dropped):', e);
        }
      }
    }, 35000);
  }

  private stopBtHeartbeat() {
    if (this.btHeartbeatTimer) {
      clearInterval(this.btHeartbeatTimer);
      this.btHeartbeatTimer = null;
    }
  }

  /**
   * Helper internal: Menghubungkan ke instance Web Bluetooth Device
   */
  async connectBtDevice(device: any): Promise<boolean> {
    this.btDevice = device;
    const devName = device.name || 'Printer Bluetooth';
    this.state.deviceName = devName;

    device.addEventListener('gattserverdisconnected', () => {
      console.warn('[PrinterHub] GATT server disconnected for device:', devName);
      this.btCharacteristic = null;
      this.state.status = 'disconnected';
      this.stopBtHeartbeat();
      this.notify();

      // Silent auto-reconnect attempt in background after 2.5s without user prompt
      if (this.state.connectionType === 'bluetooth' && this.btDevice) {
        setTimeout(() => {
          if (this.state.status !== 'connected') {
            this.tryAutoReconnect().catch(() => {});
          }
        }, 2500);
      }
    });

    const server = await device.gatt.connect();
    const targetCharacteristic = await this.findWritableCharacteristic(server);

    if (!targetCharacteristic) {
      throw new Error('Tidak ditemukan saluran transmisi ESC/POS yang cocok pada printer Bluetooth ini.');
    }

    this.btCharacteristic = targetCharacteristic;
    this.state.connectionType = 'bluetooth';
    this.state.status = 'connected';
    this.state.lastError = null;
    this.startBtHeartbeat();
    this.savePreferences();
    this.notify();
    return true;
  }

  /**
   * Helper internal: Menghubungkan ke instance WebUSB Device
   */
  async connectUsbDevice(device: any): Promise<boolean> {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const { matchedInterface, matchedEndpointNumber } = this.findUsbBulkOutEndpoint(device);

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
  }

  /**
   * Coba auto-reconnect printer struk yang tersimpan tanpa membuka pop-up pemilih
   */
  async tryAutoReconnect(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.state.status === 'connected') return true;

    // 1. Coba auto-reconnect WebUSB jika sebelumnya tipe USB
    if (this.state.connectionType === 'usb' && this.isUsbSupported()) {
      try {
        const devices = await (navigator as any).usb.getDevices();
        if (devices && devices.length > 0) {
          const target = devices.find((d: any) => d.productName === this.state.deviceName) || devices[0];
          if (target) {
            return await this.connectUsbDevice(target);
          }
        }
      } catch (err) {
        console.warn('[PrinterHub] Auto-reconnect USB failed:', err);
      }
    }

    // 2. Coba auto-reconnect Web Bluetooth
    if (this.state.connectionType === 'bluetooth' && this.isBluetoothSupported()) {
      // Prioritas 1: Gunakan in-memory btDevice (sudah ter-authorized di sesi ini, tanpa popup picker!)
      if (this.btDevice && this.btDevice.gatt) {
        try {
          console.log('[PrinterHub] Mencoba silent reconnect ke in-memory btDevice...');
          const server = await this.btDevice.gatt.connect();
          const targetChar = await this.findWritableCharacteristic(server);
          if (targetChar) {
            this.btCharacteristic = targetChar;
            this.state.status = 'connected';
            this.state.lastError = null;
            this.startBtHeartbeat();
            this.notify();
            console.log('[PrinterHub] Silent reconnect in-memory BERHASIL!');
            return true;
          }
        } catch (err) {
          console.warn('[PrinterHub] In-memory btDevice reconnect failed:', err);
        }
      }

      // Prioritas 2: Coba melalui Chromium getDevices() jika browser mendukung
      try {
        if (typeof (navigator as any).bluetooth?.getDevices === 'function') {
          const devices = await (navigator as any).bluetooth.getDevices();
          if (devices && devices.length > 0) {
            const target = devices.find((d: any) => d.name === this.state.deviceName) || devices[0];
            if (target) {
              return await this.connectBtDevice(target);
            }
          }
        }
      } catch (err) {
        console.warn('[PrinterHub] Auto-reconnect Bluetooth via getDevices failed:', err);
      }
    }

    return false;
  }

  /**
   * Hubungkan printer struk via Web Bluetooth (BLE)
   */
  async connectBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
      const errMsg = isIos
        ? 'Apple (Safari iOS) membatasi Web Bluetooth langsung. Buka aplikasi via browser Bluefy di iOS atau gunakan perangkat Android/Laptop.'
        : 'Browser Anda belum mendukung Web Bluetooth API. Gunakan Google Chrome atau Microsoft Edge.';
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

      return await this.connectBtDevice(device);
    } catch (err: any) {
      this.state.status = 'error';
      this.state.lastError = err.message || 'Gagal menghubungkan ke printer Bluetooth.';
      this.notify();
      throw err;
    }
  }

  /**
   * Hubungkan printer struk thermal via WebUSB (Kabel USB)
   */
  async connectUsb(): Promise<boolean> {
    if (!this.isUsbSupported()) {
      const errMsg = 'Browser ini belum mendukung WebUSB. Gunakan Google Chrome atau Microsoft Edge pada Laptop/PC/Android.';
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

      return await this.connectUsbDevice(device);
    } catch (err: any) {
      this.state.status = 'error';
      this.state.lastError = err.message || 'Gagal menghubungkan printer kabel USB.';
      this.notify();
      throw err;
    }
  }

  /**
   * Putuskan koneksi printer struk
   */
  disconnect() {
    try {
      this.stopBtHeartbeat();
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
   * Kirim buffer mentah (Uint8Array) ke printer struk aktif
   */
  async printRaw(data: Uint8Array): Promise<void> {
    if (this.state.status !== 'connected') {
      throw new Error('Printer struk hardware belum terhubung.');
    }

    if (this.state.connectionType === 'bluetooth') {
      await this.sendBtData(this.btCharacteristic, data);
      return;
    }

    if (this.state.connectionType === 'usb') {
      if (!this.usbDevice || !this.usbDevice.opened || this.usbEndpointNumber === null) {
        throw new Error('Koneksi USB printer tidak aktif atau terputus.');
      }
      await this.usbDevice.transferOut(this.usbEndpointNumber, data);
      return;
    }

    throw new Error('Tipe koneksi printer tidak didukung untuk pengiriman data mentah.');
  }

  // =========================================================================
  // 2. SECONDARY PRINTER: CUP LABEL STICKER (BARISTA F&B)
  // =========================================================================

  /**
   * Helper internal: Menghubungkan ke instance Web Bluetooth Device untuk Label
   */
  async connectLabelBtDevice(device: any): Promise<boolean> {
    this.labelBtDevice = device;
    const devName = device.name || 'Printer Label Cup';
    this.state.labelPrinter.deviceName = devName;

    device.addEventListener('gattserverdisconnected', () => {
      this.labelBtCharacteristic = null;
      this.state.labelPrinter.status = 'disconnected';
      this.notify();
    });

    const server = await device.gatt.connect();
    const targetCharacteristic = await this.findWritableCharacteristic(server);

    if (!targetCharacteristic) {
      throw new Error('Tidak ditemukan saluran transmisi data pada printer label Bluetooth ini.');
    }

    this.labelBtCharacteristic = targetCharacteristic;
    this.state.labelPrinter.connectionType = 'bluetooth';
    this.state.labelPrinter.status = 'connected';
    this.state.labelPrinter.lastError = null;
    this.savePreferences();
    this.notify();
    return true;
  }

  /**
   * Helper internal: Menghubungkan ke instance WebUSB Device untuk Label
   */
  async connectLabelUsbDevice(device: any): Promise<boolean> {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const { matchedInterface, matchedEndpointNumber } = this.findUsbBulkOutEndpoint(device);
    if (!matchedInterface || matchedEndpointNumber === null) {
      await device.close();
      throw new Error('Printer USB Label tidak memiliki endpoint kirim data (Bulk OUT).');
    }

    await device.claimInterface(matchedInterface.interfaceNumber);

    this.labelUsbDevice = device;
    this.labelUsbInterfaceNumber = matchedInterface.interfaceNumber;
    this.labelUsbEndpointNumber = matchedEndpointNumber;

    const devName = device.productName || device.manufacturerName || 'Printer Label USB';
    this.state.labelPrinter.deviceName = devName;
    this.state.labelPrinter.connectionType = 'usb';
    this.state.labelPrinter.status = 'connected';
    this.state.labelPrinter.lastError = null;
    this.savePreferences();
    this.notify();
    return true;
  }

  /**
   * Coba auto-reconnect printer stiker label tanpa membuka pop-up pemilih
   */
  async tryAutoReconnectLabel(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.state.labelPrinter.status === 'connected') return true;

    if (this.state.labelPrinter.connectionType === 'usb' && this.isUsbSupported()) {
      try {
        const devices = await (navigator as any).usb.getDevices();
        if (devices && devices.length > 0) {
          const target = devices.find((d: any) => d.productName === this.state.labelPrinter.deviceName) || devices[0];
          if (target) {
            return await this.connectLabelUsbDevice(target);
          }
        }
      } catch (err) {
        console.warn('[PrinterHub] Auto-reconnect Label USB error:', err);
      }
    }

    if (this.state.labelPrinter.connectionType === 'bluetooth' && this.isBluetoothSupported()) {
      try {
        if (typeof (navigator as any).bluetooth?.getDevices === 'function') {
          const devices = await (navigator as any).bluetooth.getDevices();
          if (devices && devices.length > 0) {
            const target = devices.find((d: any) => d.name === this.state.labelPrinter.deviceName) || devices[0];
            if (target) {
              return await this.connectLabelBtDevice(target);
            }
          }
        }
      } catch (err) {
        console.warn('[PrinterHub] Auto-reconnect Label Bluetooth error:', err);
      }
    }

    return false;
  }

  /**
   * Hubungkan printer stiker label cup via Web Bluetooth (BLE)
   */
  async connectLabelBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
      const errMsg = isIos
        ? 'Apple (Safari iOS) membatasi Web Bluetooth langsung. Buka aplikasi via browser Bluefy di iOS.'
        : 'Browser Anda belum mendukung Web Bluetooth API.';
      this.state.labelPrinter.lastError = errMsg;
      this.state.labelPrinter.status = 'error';
      this.notify();
      throw new Error(errMsg);
    }

    try {
      this.state.labelPrinter.status = 'connecting';
      this.state.labelPrinter.lastError = null;
      this.notify();

      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_BT_SERVICES,
      });

      if (!device) {
        throw new Error('Tidak ada perangkat Bluetooth label yang dipilih.');
      }

      return await this.connectLabelBtDevice(device);
    } catch (err: any) {
      this.state.labelPrinter.status = 'error';
      this.state.labelPrinter.lastError = err.message || 'Gagal menghubungkan printer label Bluetooth.';
      this.notify();
      throw err;
    }
  }

  /**
   * Hubungkan printer label cup via WebUSB
   */
  async connectLabelUsb(): Promise<boolean> {
    if (!this.isUsbSupported()) {
      const errMsg = 'Browser belum mendukung WebUSB untuk printer label.';
      this.state.labelPrinter.lastError = errMsg;
      this.state.labelPrinter.status = 'error';
      this.notify();
      throw new Error(errMsg);
    }

    try {
      this.state.labelPrinter.status = 'connecting';
      this.state.labelPrinter.lastError = null;
      this.notify();

      const navUsb = (navigator as any).usb;
      const device = await navUsb.requestDevice({ filters: [] });

      if (!device) {
        throw new Error('Tidak ada perangkat USB label yang dipilih.');
      }

      return await this.connectLabelUsbDevice(device);
    } catch (err: any) {
      this.state.labelPrinter.status = 'error';
      this.state.labelPrinter.lastError = err.message || 'Gagal menghubungkan printer label USB.';
      this.notify();
      throw err;
    }
  }

  /**
   * Putuskan koneksi printer label cup
   */
  disconnectLabel() {
    try {
      if (this.state.labelPrinter.connectionType === 'bluetooth' && this.labelBtDevice?.gatt?.connected) {
        this.labelBtDevice.gatt.disconnect();
      } else if (this.state.labelPrinter.connectionType === 'usb' && this.labelUsbDevice?.opened) {
        if (this.labelUsbInterfaceNumber !== null) {
          this.labelUsbDevice.releaseInterface(this.labelUsbInterfaceNumber).catch(() => {});
        }
        this.labelUsbDevice.close().catch(() => {});
      }
    } catch (e) {
      console.warn('Label printer disconnect error:', e);
    } finally {
      this.labelBtDevice = null;
      this.labelBtCharacteristic = null;
      this.labelUsbDevice = null;
      this.labelUsbInterfaceNumber = null;
      this.labelUsbEndpointNumber = null;
      this.state.labelPrinter.status = 'disconnected';
      this.notify();
    }
  }

  /**
   * Kirim buffer mentah (TSPL / ESC/POS) ke printer label aktif
   */
  async printLabelRaw(data: Uint8Array): Promise<void> {
    if (this.state.labelPrinter.status !== 'connected') {
      throw new Error('Printer stiker label cup belum terhubung.');
    }

    if (this.state.labelPrinter.connectionType === 'bluetooth') {
      await this.sendBtData(this.labelBtCharacteristic, data);
      return;
    }

    if (this.state.labelPrinter.connectionType === 'usb') {
      if (!this.labelUsbDevice || !this.labelUsbDevice.opened || this.labelUsbEndpointNumber === null) {
        throw new Error('Koneksi USB printer label terputus.');
      }
      await this.labelUsbDevice.transferOut(this.labelUsbEndpointNumber, data);
      return;
    }

    throw new Error('Koneksi printer label tidak valid.');
  }

  /**
   * Cetak stiker label cup untuk satu pesanan penuh
   */
  async printCupLabels(
    order: any,
    options: {
      onlyBeverages?: boolean;
      paperSize?: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
      protocol?: 'tspl' | 'escpos';
    } = {}
  ): Promise<{ success: boolean; cupCount: number; error?: string }> {
    const onlyBeverages = options.onlyBeverages ?? true;
    const paperSize = options.paperSize || this.state.labelPrinter.paperSize;
    const protocol = options.protocol || this.state.labelPrinter.protocol;

    const cups: CupItemDetail[] = getCupItemsFromOrder(order, onlyBeverages);
    if (!cups || cups.length === 0) {
      return { success: true, cupCount: 0 };
    }

    if (this.state.labelPrinter.status !== 'connected') {
      // Jika printer label belum terhubung, cek apakah printer receipt terhubung dan mau dipakai
      throw new Error(
        'Printer stiker label cup belum terhubung. Pasangkan printer label via Bluetooth atau USB di Pengaturan Struk.'
      );
    }

    try {
      const rawData =
        protocol === 'escpos'
          ? buildCupLabelsEscPos(cups, { paperSize, outletName: order.outlet?.name })
          : buildCupLabelsTspl(cups, { paperSize, outletName: order.outlet?.name });

      await this.printLabelRaw(rawData);
      return { success: true, cupCount: cups.length };
    } catch (err: any) {
      console.error('Print cup label error:', err);
      return { success: false, cupCount: cups.length, error: err.message };
    }
  }

  /**
   * Uji coba cetak stiker cup barista
   */
  async testPrintLabel(paperSize?: '40x30mm' | '50x30mm'): Promise<void> {
    const size = paperSize || (this.state.labelPrinter.paperSize === '50x30mm' ? '50x30mm' : '40x30mm');
    const rawData = buildTestCupLabelTspl(size);
    await this.printLabelRaw(rawData);
  }

  // =========================================================================
  // 3. UTILITY METHODS (GATT, USB ENDPOINT & CHUNK SENDING)
  // =========================================================================

  private async findWritableCharacteristic(server: any): Promise<any> {
    // 1. Scan known services
    for (const serviceUuid of KNOWN_BT_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            return c;
          }
        }
      } catch {
        // Continue
      }
    }

    // 2. Scan all services fallback
    try {
      const allServices = await server.getPrimaryServices();
      for (const s of allServices) {
        try {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              return c;
            }
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  private findUsbBulkOutEndpoint(device: any): { matchedInterface: any; matchedEndpointNumber: number | null } {
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

    return { matchedInterface, matchedEndpointNumber };
  }

  private async sendBtData(characteristic: any, data: Uint8Array): Promise<void> {
    if (!characteristic) {
      throw new Error('Saluran transmisi Bluetooth tidak aktif.');
    }
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  // =========================================================================
  // 4. PRINT RECEIPT, X/Z REPORT & CASH DRAWER KICK
  // =========================================================================

  /**
   * Cetak struk pesanan (Direct ESC/POS atau Dialog Iframe Fallback)
   */
  async printReceipt(
    order: any,
    options: EscPosOptions = {}
  ): Promise<{ success: boolean; mode: 'bluetooth' | 'usb' | 'system'; error?: string }> {
    const paperSize = options.paperSize || this.state.paperSize;
    let isHardwareConnected = this.state.status === 'connected';

    // Coba auto-reconnect hardware jika sebelumnya pernah di-pair
    if (!isHardwareConnected && (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')) {
      isHardwareConnected = await this.tryAutoReconnect();
    }

    if (isHardwareConnected && (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')) {
      try {
        const rawBytes = buildReceiptEscPos(order, {
          ...options,
          paperSize,
        });

        const hasCash = order.payments?.some((p: any) => (p.method || p.paymentMethod) === 'CASH');
        if (hasCash && this.state.drawerKickEnabled) {
          await this.kickCashDrawer().catch(() => {});
        }

        await this.printRaw(rawBytes);
        return { success: true, mode: this.state.connectionType };
      } catch (err: any) {
        console.warn('Hardware print failed, falling back to iframe print:', err);
        printElementViaThermalIframe('thermal-receipt-content', { paperWidth: paperSize });
        return { success: true, mode: 'system', error: err.message };
      }
    }

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
  ): Promise<{ success: boolean; mode: 'bluetooth' | 'usb' | 'system'; error?: string }> {
    const paperSize = options.paperSize || this.state.paperSize;
    let isHardwareConnected = this.state.status === 'connected';

    // Coba auto-reconnect hardware jika sebelumnya pernah di-pair
    if (!isHardwareConnected) {
      isHardwareConnected = await this.tryAutoReconnect();
    }

    if (isHardwareConnected && (this.state.connectionType === 'bluetooth' || this.state.connectionType === 'usb')) {
      try {
        const rawBytes = buildXZReportEscPos(reportData, type, { ...options, paperSize });
        await this.printRaw(rawBytes);
        return { success: true, mode: this.state.connectionType };
      } catch (err: any) {
        console.warn('Hardware X/Z report print failed, falling back to iframe:', err);
        const elementId = type === 'X' ? 'x-report-printable' : 'z-report-printable';
        printElementViaThermalIframe(elementId, {
          paperWidth: paperSize,
          title: `${type}-Report Kasir`,
        });
        return { success: true, mode: 'system', error: err.message };
      }
    }

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
