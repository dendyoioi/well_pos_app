import React from 'react';
import { Tag, Clock } from 'lucide-react';
import type { CupLabelConfig } from '../types/outlet';

interface CupLabelPreviewProps {
  config: CupLabelConfig;
  brandName?: string;
  storeName?: string;
}

export const CupLabelPreview: React.FC<CupLabelPreviewProps> = ({
  config,
  brandName = 'WELL POS COFFEE',
  storeName = 'Outlet Utama',
}) => {
  const paperSize = config.paperSize || '40x30mm';

  // Rasio visual stiker cup thermal
  const is50x30 = paperSize === '50x30mm';
  const is40x20 = paperSize === '40x20mm';
  const is50x40 = paperSize === '50x40mm';

  return (
    <div className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-3 text-xs">
        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-blue-900" />
          <span>Pratinjau Fisik Stiker Cup ({paperSize})</span>
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
          Thermal Gap 2mm
        </span>
      </div>

      {/* Label Thermal Physical Sticker Simulation */}
      <div
        className={`bg-white border-2 border-slate-300 rounded-lg p-3 shadow-md text-slate-900 font-mono select-none transition-all flex flex-col justify-between ${
          is50x30
            ? 'w-[280px] min-h-[175px]'
            : is50x40
            ? 'w-[280px] min-h-[220px]'
            : is40x20
            ? 'w-[230px] min-h-[130px]'
            : 'w-[230px] min-h-[175px]' // Default 40x30mm
        }`}
        style={{
          boxShadow: '0 4px 14px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between border-b border-dashed border-slate-300 pb-1 mb-1.5 text-[10px]">
            <span className="font-black tracking-tight text-slate-800">
              {config.customHeader ? config.customHeader : `[DINE IN] MEJA 04 #07`}
            </span>
            <span className="text-[9px] text-slate-500 font-sans font-bold flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              <span>14:32</span>
            </span>
          </div>

          {/* Product Name (Bold) */}
          <div className="text-xs sm:text-[13px] font-black leading-tight tracking-tight text-slate-950 uppercase">
            KOPI SUSU AREN
          </div>

          {/* Variant */}
          <div className="text-[10px] font-extrabold text-slate-700 mt-0.5">
            * Large / Less Ice
          </div>

          {/* Modifiers / Add-ons */}
          {(config.showModifiers ?? true) && (
            <div className="text-[9px] text-slate-600 mt-1 space-y-0.5 pl-1 border-l border-slate-300">
              <div>- Less Sugar 50%</div>
              <div>- Extra Espresso Shot (+Rp 5.000)</div>
              <div>- Oatmilk Base</div>
            </div>
          )}

          {/* Barista Notes */}
          <div className="text-[9px] text-amber-800 bg-amber-50/80 px-1 py-0.5 rounded mt-1 italic">
            Catatan: Gelas kertas ramah lingkungan
          </div>
        </div>

        {/* Footer info: Cup Index + Customer Name */}
        <div className="pt-1.5 mt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <span className="font-extrabold text-slate-800">
            Cup [1/2]
            {(config.showCustomerName ?? true) && ' • Dimas'}
          </span>
          <span className="text-[8px] font-sans text-slate-400 truncate max-w-[90px]">
            {(config.showStoreName ?? true) ? storeName : brandName}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-2.5 text-center font-sans font-medium">
        * Stiker ditempel pada dinding cup kopi atau packaging makanan takeaway.
      </p>
    </div>
  );
};
