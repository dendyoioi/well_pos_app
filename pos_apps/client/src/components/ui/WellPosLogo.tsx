import React from 'react';

export interface WellPosLogoProps {
  /**
   * Ukuran kotak logo:
   * - 'xs': 20x20px (w-5 h-5)
   * - 'sm': 28x28px (w-7 h-7)
   * - 'md': 36x36px (w-9 h-9)
   * - 'lg': 48x48px (w-12 h-12)
   * - 'xl': 64x64px (w-16 h-16)
   * - '2xl': 80x80px (w-20 h-20)
   * atau custom class string
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string;
  /**
   * Gaya tampilan:
   * - 'rounded' (default): square dengan sudut halus/squircle (rounded-xl/2xl)
   * - 'square': square murni tanpa radius (rounded-none)
   * - 'symbol': logo mark putih transparan tanpa background
   * - 'dark-symbol': logo mark gelap transparan tanpa background
   */
  variant?: 'rounded' | 'square' | 'symbol' | 'dark-symbol';
  className?: string;
  showText?: boolean;
  subtitle?: string;
  textClassName?: string;
  alt?: string;
}

const SIZE_MAP: Record<string, { container: string; iconPadding: string }> = {
  xs: { container: 'w-5 h-5 rounded-md', iconPadding: 'p-0.5' },
  sm: { container: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl', iconPadding: 'p-1' },
  md: { container: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl', iconPadding: 'p-1.5' },
  lg: { container: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl', iconPadding: 'p-2' },
  xl: { container: 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl', iconPadding: 'p-2.5 sm:p-3' },
  '2xl': { container: 'w-24 h-24 rounded-3xl', iconPadding: 'p-3.5' },
};

export const WellPosLogo: React.FC<WellPosLogoProps> = ({
  size = 'md',
  variant = 'rounded',
  className = '',
  showText = false,
  subtitle,
  textClassName = '',
  alt = 'Well POS Logo',
}) => {
  const sizeConfig = SIZE_MAP[size] || {
    container: size, // custom class string jika bukan predefined key
    iconPadding: 'p-1.5',
  };

  const isSquare = variant === 'square';
  const isSymbolOnly = variant === 'symbol' || variant === 'dark-symbol';
  const isDarkSymbol = variant === 'dark-symbol';

  // Radius handling
  let radiusClass = sizeConfig.container.split(' ').find((c) => c.startsWith('rounded-')) || 'rounded-xl';
  if (isSquare) {
    radiusClass = 'rounded-none';
  }

  const baseContainerClass = sizeConfig.container
    .split(' ')
    .filter((c) => !c.startsWith('rounded-'))
    .join(' ');

  const logoMarkSrc = isDarkSymbol
    ? '/images/wellpos-symbol-dark.png'
    : '/images/wellpos-symbol-white.png';

  const logoElement = isSymbolOnly ? (
    <div className={`relative flex items-center justify-center shrink-0 ${baseContainerClass} ${className}`}>
      <img
        src={logoMarkSrc}
        alt={alt}
        className="w-full h-full object-contain select-none pointer-events-none"
        loading="eager"
      />
    </div>
  ) : (
    <div
      className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-[#090d16] via-[#10244c] to-[#2563eb] shadow-md shadow-blue-950/20 border border-white/10 ${radiusClass} ${baseContainerClass} ${sizeConfig.iconPadding} ${className}`}
    >
      <img
        src="/images/wellpos-symbol-white.png"
        alt={alt}
        className="w-full h-full object-contain select-none pointer-events-none drop-shadow-xs"
        loading="eager"
      />
    </div>
  );

  if (!showText) {
    return logoElement;
  }

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {logoElement}
      <div className="flex flex-col">
        <span className={`font-black tracking-tight leading-tight ${textClassName || 'text-slate-900'}`}>
          Well POS
        </span>
        {subtitle && (
          <span className="text-[10px] text-slate-500 font-medium leading-tight">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
