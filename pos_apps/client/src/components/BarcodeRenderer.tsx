import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export interface BarcodeRendererProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 42,
  displayValue = true,
  fontSize = 11,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      // Auto-detect format fallback jika value tidak cocok dengan format target (misal EAN13 harus 12/13 digit angka)
      let resolvedFormat = format;
      const cleanVal = String(value).trim();

      if (format === 'EAN13' && (!/^\d{12,13}$/.test(cleanVal))) {
        resolvedFormat = 'CODE128';
      }

      JsBarcode(svgRef.current, cleanVal, {
        format: resolvedFormat,
        width,
        height,
        displayValue,
        fontSize,
        font: 'monospace',
        textMargin: 2,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (err) {
      console.warn('Gagal merender barcode dengan JsBarcode:', err);
      // Fallback coba CODE128
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, String(value).trim(), {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            margin: 2,
          });
        }
      } catch {
        // Abaikan jika string benar-benar invalid
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) {
    return <span className="text-[10px] text-slate-400 italic">(Tidak ada kode)</span>;
  }

  return (
    <svg
      ref={svgRef}
      className={`max-w-full block mx-auto ${className}`}
      aria-label={`Barcode ${value}`}
    />
  );
};
