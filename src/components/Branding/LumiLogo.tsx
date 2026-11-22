import React from 'react';

interface LumiLogoProps {
  collapsed?: boolean;
  className?: string;
}

export const LumiLogo: React.FC<LumiLogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/lumi-logo.jpg"
        alt="LUMI"
        className={`object-contain ${
          collapsed ? 'h-7 w-7' : 'h-8 max-w-[160px]'
        }`}
      />
    </div>
  );
};
