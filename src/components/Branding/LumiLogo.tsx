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
          className="h-9 w-9 object-contain rounded transition-transform hover:scale-105"
        />
      </div>
    );
  }

  const sizeIcon = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-11 w-11',
    hero: 'h-20 w-20'
  };

  const sizeText = {
    sm: 'text-sm tracking-widest',
    md: 'text-base tracking-widest',
    lg: 'text-xl tracking-widest',
    hero: 'text-3xl tracking-widest'
  };

  return (
    <div className={`flex items-center space-x-2.5 select-none ${className}`}>
      <img
        src="/lumi-logo.jpg"
        alt="LUMI"
        className={`object-contain transition-all duration-200 ${sizeIcon[size]}`}
      />
      <span className={`font-display font-normal text-[#F5F4F1] uppercase ${sizeText[size]}`}>
        LUMI
      </span>
    </div>
  );
};
