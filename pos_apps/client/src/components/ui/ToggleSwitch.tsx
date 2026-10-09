import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  name?: string;
  title?: string;
}

/**
 * Komponen Kanonikal ToggleSwitch (Modern iOS/Material Style)
 * Menggunakan track rounded-full dengan knob bola putih yang bergeser mulus.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  id,
  name,
  title,
}) => {
  const switchSizes = {
    sm: { track: 'w-8 h-4.5', knob: 'w-3.5 h-3.5', translate: 'translate-x-3.5' },
    md: { track: 'w-11 h-6', knob: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7.5', knob: 'w-6.5 h-6.5', translate: 'translate-x-6.5' },
  };

  const currentSize = switchSizes[size];

  return (
    <button
      type="button"
      role="switch"
      id={id}
      name={name}
      title={title}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex items-center ${currentSize.track} shrink-0 cursor-pointer rounded-full p-0.5 border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-900 hover:bg-blue-800' : 'bg-slate-300 hover:bg-slate-400'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block ${currentSize.knob} transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? currentSize.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
};
