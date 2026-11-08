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

  // Label Printing states
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [labelPrintSuccess, setLabelPrintSuccess] = useState(false);
  const [labelPrintError, setLabelPrintError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = thermalPrinterHub.addListener((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Primary (Receipt) connection methods
  const connectBluetooth = useCallback(async () => {
    setPrintError(null);
    try {
      return await thermalPrinterHub.connectBluetooth();
    } catch (err: any) {
      setPrintError(err.message || 'Gagal menghubungkan printer struk Bluetooth');
      return false;
    }
  }, []);

  const connectUsb = useCallback(async () => {
    setPrintError(null);
    try {
      return await thermalPrinterHub.connectUsb();
    } catch (err: any) {
      setPrintError(err.message || 'Gagal menghubungkan printer struk USB');
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

  // Secondary (Cup Label) connection methods
  const connectLabelBluetooth = useCallback(async () => {
    setLabelPrintError(null);
    try {
      return await thermalPrinterHub.connectLabelBluetooth();
    } catch (err: any) {
      setLabelPrintError(err.message || 'Gagal menghubungkan printer label Bluetooth');
      return false;
    }
  }, []);

  const connectLabelUsb = useCallback(async () => {
    setLabelPrintError(null);
    try {
      return await thermalPrinterHub.connectLabelUsb();
    } catch (err: any) {
      setLabelPrintError(err.message || 'Gagal menghubungkan printer label USB');
      return false;
    }
  }, []);

  const disconnectLabel = useCallback(() => {
    thermalPrinterHub.disconnectLabel();
    setLabelPrintError(null);
    setLabelPrintSuccess(false);
  }, []);

  const setLabelPaperSize = useCallback((size: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm') => {
    thermalPrinterHub.setLabelPaperSize(size);
  }, []);

  const setLabelProtocol = useCallback((protocol: 'tspl' | 'escpos') => {
    thermalPrinterHub.setLabelProtocol(protocol);
  }, []);

  // Printing receipts & X/Z
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

  // Cup Label Print executions
  const printCupLabels = useCallback(
    async (
      order: any,
      options: {
        onlyBeverages?: boolean;
        paperSize?: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
        protocol?: 'tspl' | 'escpos';
      } = {}
    ) => {
      setIsPrintingLabel(true);
      setLabelPrintError(null);
      setLabelPrintSuccess(false);
      try {
        const res = await thermalPrinterHub.printCupLabels(order, options);
        if (res.success) {
          setLabelPrintSuccess(true);
          setTimeout(() => setLabelPrintSuccess(false), 3000);
        } else {
          setLabelPrintError(res.error || 'Gagal mencetak stiker label cup');
          setTimeout(() => setLabelPrintError(null), 4000);
        }
        return res;
      } catch (err: any) {
        setLabelPrintError(err.message || 'Gagal mencetak stiker label cup');
        setTimeout(() => setLabelPrintError(null), 4000);
        throw err;
      } finally {
        setIsPrintingLabel(false);
      }
    },
    []
  );

  const testPrintLabel = useCallback(async (paperSize?: '40x30mm' | '50x30mm') => {
    setIsPrintingLabel(true);
    setLabelPrintError(null);
    setLabelPrintSuccess(false);
    try {
      await thermalPrinterHub.testPrintLabel(paperSize);
      setLabelPrintSuccess(true);
      setTimeout(() => setLabelPrintSuccess(false), 3000);
      return true;
    } catch (err: any) {
      setLabelPrintError(err.message || 'Gagal mencetak uji coba label cup');
      setTimeout(() => setLabelPrintError(null), 4000);
      throw err;
    } finally {
      setIsPrintingLabel(false);
    }
  }, []);

  return {
    ...state,
    // Primary status
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isPrinting,
    printSuccess,
    printError,

    // Label printer status
    isLabelConnected: state.labelPrinter.status === 'connected',
    isLabelConnecting: state.labelPrinter.status === 'connecting',
    isPrintingLabel,
    labelPrintSuccess,
    labelPrintError,

    // Platform capability checks
    isBluetoothSupported: thermalPrinterHub.isBluetoothSupported(),
    isUsbSupported: thermalPrinterHub.isUsbSupported(),

    // Primary printer actions
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

    // Label printer actions
    connectLabelBluetooth,
    connectLabelUsb,
    disconnectLabel,
    setLabelPaperSize,
    setLabelProtocol,
    printCupLabels,
    testPrintLabel,
  };
}
