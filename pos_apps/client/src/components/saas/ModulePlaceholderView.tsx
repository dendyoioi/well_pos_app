import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ModulePlaceholderViewProps {
  title: string;
  category: string;
  description: string;
  icon: LucideIcon;
  roadmapStage?: string;
  keyFeatures?: string[];
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export const ModulePlaceholderView: React.FC<ModulePlaceholderViewProps> = ({
  title,
  category,
  description,
  icon: Icon,
  roadmapStage = 'Tahap Pengembangan Aktif',
  keyFeatures = [],
  primaryActionLabel,
  onPrimaryAction,
}) => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-3">
        <span>Backoffice</span>
        <span>/</span>
        <span className="text-slate-600">{category}</span>
        <span>/</span>
        <span className="text-blue-900 font-bold">{title}</span>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-8 h-8 stroke-[2]" />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                {category}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>{roadmapStage}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {title}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              {description}
            </p>

            {/* Key Features List */}
            {keyFeatures.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Fitur &amp; Kemampuan F&amp;B yang Disiapkan:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {keyFeatures.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            {primaryActionLabel && onPrimaryAction && (
              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={onPrimaryAction}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>{primaryActionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
