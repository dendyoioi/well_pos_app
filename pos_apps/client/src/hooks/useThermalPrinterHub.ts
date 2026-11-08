import { useState, useEffect, useCallback } from 'react';
import {
  thermalPrinterHub,
  type PrinterHubState,
} from '../services/thermalPrinterHub.service';
import type { EscPosOptions } from '../utils/escpos';

export function useThermalPrinterHub() {
  const [state, setState] = useState<PrinterHubState>(thermalPrinterHub.getState());
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = thermalPrinterHub.addListener((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const connectBluetooth = useCallback(async () => {
    setPrintError(null);
    try {
      return await thermalPrinterHub.connectBluetooth();
    } catch (err: any) {
      setPrintError(err.message || 'Gagal menghubungkan printer Bluetooth');
      return false;
    }
  }, []);

  const connectUsb = useCallback(async () => {
    setPrintError(null);
    try {
      return await thermalPrinterHub.connectUsb();
    } catch (err: any) {
      setPrintError(err.message || 'Gagal menghubungkan printer USB');
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    thermalPrinterHub.disconnect();
    setPrintError(null);
    setPrintSuccess(false);
  }, []);

  const setPaperSize = useCallback((size: '58mm' | '80mm') => {
    thermalPrinterHub.setPaperSize(size);
  }, []);

  const setAutoPrint = useCallback((enabled: boolean) => {
    thermalPrinterHub.setAutoPrint(enabled);
  }, []);

  const setDrawerKick = useCallback((enabled: boolean) => {
    thermalPrinterHub.setDrawerKick(enabled);
  }, []);

  const printReceipt = useCallback(
    async (order: any, options: EscPosOptions = {}) => {
      setIsPrinting(true);
      setPrintError(null);
      setPrintSuccess(false);
      try {
        const res = await thermalPrinterHub.printReceipt(order, options);
        setPrintSuccess(true);
        setTimeout(() => setPrintSuccess(false), 3000);
        return res;
      } catch (err: any) {
        setPrintError(err.message || 'Gagal mencetak struk');
        setTimeout(() => setPrintError(null), 4000);
        throw err;
      } finally {
        setIsPrinting(false);
      }
    },
    []
  );

  const printXZReport = useCallback(
    async (reportData: any, type: 'X' | 'Z', options: EscPosOptions = {}) => {
      setIsPrinting(true);
      setPrintError(null);
      setPrintSuccess(false);
      try {
        const res = await thermalPrinterHub.printXZReport(reportData, type, options);
        setPrintSuccess(true);
        setTimeout(() => setPrintSuccess(false), 3000);
        return res;
      } catch (err: any) {
        setPrintError(err.message || 'Gagal mencetak slip shift');
        setTimeout(() => setPrintError(null), 4000);
        throw err;
      } finally {
        setIsPrinting(false);
      }
    },
    []
  );

  const testPrint = useCallback(async (paperSize?: '58mm' | '80mm') => {
    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccess(false);
    try {
      await thermalPrinterHub.testPrint(paperSize);
      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 3000);
      return true;
    } catch (err: any) {
      setPrintError(err.message || 'Gagal mencetak uji coba');
      setTimeout(() => setPrintError(null), 4000);
      throw err;
    } finally {
      setIsPrinting(false);
    }
  }, []);

  const kickCashDrawer = useCallback(async () => {
    try {
      await thermalPrinterHub.kickCashDrawer();
      return true;
    } catch (err: any) {
      console.warn('Kick cash drawer failed:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isBluetoothSupported: thermalPrinterHub.isBluetoothSupported(),
    isUsbSupported: thermalPrinterHub.isUsbSupported(),
    isPrinting,
    printSuccess,
    printError,
    connectBluetooth,
    connectUsb,
    disconnect,
    setPaperSize,
    setAutoPrint,
    setDrawerKick,
    printReceipt,
    printXZReport,
    testPrint,
    kickCashDrawer,
  };
}
