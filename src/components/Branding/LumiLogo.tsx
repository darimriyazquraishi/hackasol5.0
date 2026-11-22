import React from 'react';

interface LumiLogoProps {
  collapsed?: boolean;
  className?: string;
}

export const LumiLogo: React.FC<LumiLogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={`flex items-center space-x-2.5 select-none ${className}`}>
      {/* Precision Geometric Monolith Logo Mark */}
      <div className="w-7 h-7 rounded-sm bg-[#191919] border border-[#303030] flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden group">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          {/* Base facet */}
          <path
            d="M12 2L20 7V17L12 22L4 17V7L12 2Z"
            stroke="#9C9C9C"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Warm Taupe Accent Core */}
          <path
            d="M12 6L17 9.5V14.5L12 18L7 14.5V9.5L12 6Z"
            fill="#987654"
            fillOpacity="0.85"
            stroke="#987654"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Inner Light Monolith */}
          <path
            d="M12 9L14.5 11V13L12 15L9.5 13V11L12 9Z"
            fill="#F5F4F1"
          />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5 leading-none">
            <span className="font-mono font-bold text-sm tracking-[0.2em] text-[#F5F4F1]">
              LUMI
            </span>
            <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              CORE
            </span>
          </div>
          <span className="text-[10px] text-[#9C9C9C] font-mono tracking-wider mt-0.5">
            DESKTOP WORKBENCH
          </span>
        </div>
      )}
    </div>
  );
};
