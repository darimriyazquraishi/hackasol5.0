import React from 'react';

interface LumiLogoProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

/**
 * Authoritative LUMI Brand Identity Component
 *
 * Exclusively loads from the supplied logo asset (/lumi-logo.jpg).
 * Strictly preserves aspect ratio with object-contain.
 * Displayed prominently across the application.
 */
export const LumiLogo: React.FC<LumiLogoProps> = ({
  collapsed = false,
  className = '',
  size = 'md'
}) => {
  if (collapsed) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <img
          src="/lumi-logo.jpg"
          alt="LUMI"
          className="h-10 w-10 object-contain rounded transition-transform hover:scale-105"
        />
      </div>
    );
  }

  const sizeClasses = {
    sm: 'h-10 max-w-[160px]',
    md: 'h-14 max-w-[220px]',
    lg: 'h-20 max-w-[280px]',
    hero: 'h-32 md:h-36 max-w-[380px]'
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/lumi-logo.jpg"
        alt="LUMI"
        className={`object-contain transition-all duration-200 ${sizeClasses[size]}`}
      />
    </div>
  );
};
