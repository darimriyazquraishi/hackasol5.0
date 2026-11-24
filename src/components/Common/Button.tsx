import React from 'react';
import { ArrowUp, Square, Loader2 } from 'lucide-react';

export interface SendButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  tooltip?: string;
  className?: string;
}

/**
 * Premium Send & Stop Button for AI Composers
 * Delivers tactile micro-interactions, distinct state transitions,
 * and unified brand styling across all LUMI conversational inputs.
 */
export const SendButton: React.FC<SendButtonProps> = ({
  onClick,
  disabled = false,
  isGenerating = false,
  onStop,
  size = 'md',
  showLabel = false,
  label = 'Send',
  tooltip,
  className = ''
}) => {
  // If actively generating, render tactile Stop button
  if (isGenerating) {
    const sizeClasses =
      size === 'sm'
        ? 'px-2 py-1 text-[11px] space-x-1'
        : size === 'lg'
        ? 'px-3.5 py-1.5 text-xs space-x-1.5'
        : 'px-2.5 py-1.5 text-xs space-x-1.5';

    return (
      <button
        type="button"
        onClick={onStop}
        title="Stop generation (Esc)"
        className={`rounded-lg font-mono font-medium bg-[#241212] hover:bg-[#351616] text-red-200 border border-red-800/80 shadow-sm flex items-center justify-center active:scale-95 transition-all duration-150 cursor-pointer ${sizeClasses} ${className}`}
      >
        <Square className="w-3 h-3 fill-current animate-pulse text-red-300" />
        <span>Stop</span>
      </button>
    );
  }

  // Active / Ready to send vs Disabled
  const isEnabled = !disabled;

  const sizeClasses = {
    sm: showLabel ? 'px-2.5 py-1 text-[11px] space-x-1' : 'w-7 h-7 p-1',
    md: showLabel ? 'px-3 py-1.5 text-xs space-x-1.5' : 'w-8 h-8 p-1.5',
    lg: showLabel ? 'px-4 py-2 text-xs space-x-2' : 'w-9 h-9 p-2'
  }[size];

  const stateClasses = isEnabled
    ? 'bg-[#987654] hover:bg-[#866747] text-[#F5F4F1] border border-[#a88664]/30 shadow-sm hover:shadow-[#987654]/20 active:scale-95 cursor-pointer'
    : 'bg-[#181818] text-[#555555] border border-[#262626] cursor-not-allowed opacity-60';

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4 h-4'
  }[size];

  return (
    <button
      type="button"
      onClick={isEnabled ? onClick : undefined}
      disabled={!isEnabled}
      title={tooltip || (isEnabled ? 'Send prompt (Enter)' : 'Enter text to send')}
      className={`rounded-lg font-sans font-medium flex items-center justify-center transition-all duration-150 shrink-0 ${sizeClasses} ${stateClasses} ${className}`}
    >
      {showLabel && <span>{label}</span>}
      <ArrowUp className={`${iconSizes} stroke-[2.2] transition-transform group-hover:-translate-y-0.5`} />
    </button>
  );
};

export interface LumiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Impeccable Design System Button for LUMI Workbenches
 */
export const LumiButton: React.FC<LumiButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] rounded space-x-1',
    sm: 'px-2.5 py-1 text-xs rounded-md space-x-1.5',
    md: 'px-3 py-1.5 text-xs rounded-lg space-x-2',
    lg: 'px-4 py-2 text-sm rounded-lg space-x-2.5'
  }[size];

  const variantClasses = {
    primary:
      'bg-[#987654] hover:bg-[#866747] text-[#F5F4F1] border border-[#a88664]/30 shadow-sm hover:shadow-[#987654]/15 active:scale-[0.98]',
    secondary:
      'bg-[#181818] hover:bg-[#222222] text-[#D5D2CC] hover:text-[#F5F4F1] border border-[#303030] hover:border-[#444444] active:scale-[0.98]',
    danger:
      'bg-[#241212] hover:bg-[#331616] text-red-200 border border-red-800/80 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-[#1a1a1a] text-[#9C9C9C] hover:text-[#F5F4F1] border border-transparent active:scale-[0.98]'
  }[variant];

  const disabledClasses = disabled || loading
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer';

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-sans font-medium transition-all duration-150 select-none ${sizeClasses} ${variantClasses} ${disabledClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};
