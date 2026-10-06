import { useState, useEffect, useCallback } from 'react';
import { bluetoothPrinter } from '../services/bluetoothPrinter.service';
import type { BluetoothPrinterStatus } from '../services/bluetoothPrinter.service';
import type { EscPosOptions } from '../utils/escpos';

export function useBluetoothPrinter() {
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<BluetoothPrinterStatus>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setIsSupported(bluetoothPrinter.isSupported());

    const unsubscribe = bluetoothPrinter.addListener((st, name, err) => {
      setStatus(st);
      setDeviceName(name);
      setLastError(err || null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const connect = useCallback(async () => {
    setLastError(null);
    try {
      await bluetoothPrinter.connect();
      return true;
    } catch (err: any) {
      setLastError(err.message || 'Gagal menghubungkan printer Bluetooth');
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    bluetoothPrinter.disconnect();
  }, []);

  const printReceipt = useCallback(
    async (order: any, options?: EscPosOptions) => {
      setIsPrinting(true);
      setLastError(null);
      try {
        await bluetoothPrinter.printReceipt(order, options);
        return true;
      } catch (err: any) {
        setLastError(err.message || 'Gagal mencetak struk via Bluetooth');
        throw err;
      } finally {
        setIsPrinting(false);
      }
    },
    []
  );

  const testPrint = useCallback(async (paperSize: '58mm' | '80mm' = '58mm') => {
    setIsPrinting(true);
    setLastError(null);
    try {
      await bluetoothPrinter.testPrint(paperSize);
      return true;
    } catch (err: any) {
      setLastError(err.message || 'Gagal mengirim cetak uji coba');
      throw err;
    } finally {
      setIsPrinting(false);
    }
  }, []);

  const kickDrawer = useCallback(async () => {
    try {
      await bluetoothPrinter.kickDrawer();
      return true;
    } catch (err: any) {
      setLastError(err.message || 'Gagal memicu laci kasir');
      throw err;
    }
  }, []);

  return {
    isSupported,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    status,
    deviceName,
    lastError,
    isPrinting,
    connect,
    disconnect,
    printReceipt,
    testPrint,
    kickDrawer,
  };
}
