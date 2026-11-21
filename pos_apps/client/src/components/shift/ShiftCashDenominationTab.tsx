import React from 'react';
import { Calculator, ChevronDown, ChevronUp, RotateCcw, Coins, Wallet } from 'lucide-react';

export const DENOM_LIST = [
  { value: 100000, label: 'Rp 100.000', type: 'paper' },
  { value: 50000, label: 'Rp 50.000', type: 'paper' },
  { value: 20000, label: 'Rp 20.000', type: 'paper' },
  { value: 10000, label: 'Rp 10.000', type: 'paper' },
  { value: 5000, label: 'Rp 5.000', type: 'paper' },
  { value: 2000, label: 'Rp 2.000', type: 'paper' },
  { value: 1000, label: 'Rp 1.000', type: 'paper' },
  { value: 500, label: 'Rp 500 (Koin)', type: 'coin' },
  { value: 200, label: 'Rp 200 (Koin)', type: 'coin' },
  { value: 100, label: 'Rp 100 (Koin)', type: 'coin' },
];

interface ShiftCashDenominationTabProps {
  showDenomCalculator: boolean;
  setShowDenomCalculator: (val: boolean) => void;
  denominations: { [key: number]: number };
  setDenominations: React.Dispatch<React.SetStateAction<{ [key: number]: number }>>;
  setActualCash: (val: number) => void;
}

export const ShiftCashDenominationTab: React.FC<ShiftCashDenominationTabProps> = ({
  showDenomCalculator,
  setShowDenomCalculator,
  denominations,
  setDenominations,
  setActualCash,
}) => {
  const totalDenomSum = Object.entries(denominations).reduce(
    (acc, [val, count]) => acc + Number(val) * count,
    0
  );
  const totalDenomCount = Object.values(denominations).reduce(
    (acc, count) => acc + count,
    0
  );

  const handleDenomChange = (val: number, inputVal: string) => {
    const count = inputVal === '' ? 0 : Math.max(0, parseInt(inputVal, 10) || 0);
    const updated = { ...denominations, [val]: count };
    setDenominations(updated);
    const sum = Object.entries(updated).reduce(
      (acc, [v, c]) => acc + Number(v) * c,
      0
    );
    setActualCash(sum);
  };

  const handleResetDenom = () => {
    const reset = {
      100000: 0, 50000: 0, 20000: 0, 10000: 0, 5000: 0, 2000: 0, 1000: 0, 500: 0, 200: 0, 100: 0,
    };
    setDenominations(reset);
    setActualCash(0);
  };

  return (
    <div className="border border-blue-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
      <button
        type="button"
        data-testid="toggle-denom-calc-btn"
        onClick={() => setShowDenomCalculator(!showDenomCalculator)}
        className="w-full px-4 py-3 bg-blue-50/70 hover:bg-blue-50 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Kalkulator Lembar Pecahan Uang Fisik
            </span>
            <span className="text-[11px] text-slate-500">
              {totalDenomSum > 0
                ? `${totalDenomCount} lembar/koin dihitung = Rp ${totalDenomSum.toLocaleString('id-ID')}`
                : 'Buka untuk menghitung uang kertas & koin per lembar'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalDenomSum > 0 && (
            <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
              Rp {totalDenomSum.toLocaleString('id-ID')}
            </span>
          )}
          {showDenomCalculator ? (
            <ChevronUp className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600" />
          )}
        </div>
      </button>

      {showDenomCalculator && (
        <div className="p-3.5 border-t border-blue-100 bg-slate-50/50 space-y-3" data-testid="denom-calc-container">
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold px-0.5">
            <span>Pecahan Rupiah (Kertas & Koin)</span>
            <button
              type="button"
              data-testid="reset-denom-btn"
              onClick={handleResetDenom}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Hitungan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DENOM_LIST.map((item) => {
              const count = denominations[item.value] || 0;
              const subtotal = item.value * count;
              return (
                <div
                  key={item.value}
                  className={`p-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                    count > 0 ? 'bg-blue-50/80 border-blue-300' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      {item.type === 'coin' ? (
                        <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-800">{item.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Sub: Rp {subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      data-testid={`denom-input-${item.value}`}
                      value={count === 0 ? '' : count}
                      onChange={(e) => handleDenomChange(item.value, e.target.value)}
                      placeholder="0"
                      className="h-9 w-16 px-2 text-center text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 rounded-lg outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-medium">
                      {item.type === 'coin' ? 'koin' : 'lbr'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Total Hitungan Pecahan:</span>
            <span className="text-sm font-black text-blue-950 font-mono">
              Rp {totalDenomSum.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
