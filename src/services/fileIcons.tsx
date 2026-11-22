import React from 'react';
import {
  FileCode2,
  FileJson,
  FileText,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Image,
  FileCode,
  Terminal,
  Settings,
  Flame,
  Binary
} from 'lucide-react';

interface IconProps {
  name: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
}

export const getFileIcon = ({ name, isFolder, isOpen, className = "w-4 h-4" }: IconProps) => {
  if (isFolder) {
    if (isOpen) {
      return <FolderOpen className={`${className} text-[#dcb67a] shrink-0`} />;
    }
    return <Folder className={`${className} text-[#dcb67a] shrink-0`} />;
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'ts':
      return (
        <span className={`${className} font-bold text-[10px] bg-[#3178c6] text-white flex items-center justify-center rounded-sm shrink-0 leading-none`}>
          TS
        </span>
      );
    case 'tsx':
      return (
        <span className={`${className} font-bold text-[10px] bg-[#2b7489] text-[#61dafb] flex items-center justify-center rounded-sm shrink-0 leading-none`}>
          ⚛
        </span>
      );
    case 'js':
    case 'mjs':
      return (
        <span className={`${className} font-bold text-[10px] bg-[#f7df1e] text-black flex items-center justify-center rounded-sm shrink-0 leading-none`}>
          JS
        </span>
      );
    case 'jsx':
      return (
        <span className={`${className} font-bold text-[10px] bg-[#20232a] text-[#61dafb] flex items-center justify-center rounded-sm shrink-0 leading-none border border-[#61dafb]/40`}>
          ⚛
        </span>
      );
    case 'json':
      return <FileJson className={`${className} text-[#cbcb41] shrink-0`} />;
    case 'html':
    case 'htm':
      return <FileCode2 className={`${className} text-[#e34c26] shrink-0`} />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <FileCode className={`${className} text-[#563d7c] shrink-0`} />;
    case 'md':
    case 'markdown':
      return <FileText className={`${className} text-[#42a5f5] shrink-0`} />;
    case 'py':
      return (
        <span className={`${className} font-bold text-[10px] bg-[#3776ab] text-[#ffd43b] flex items-center justify-center rounded-sm shrink-0 leading-none`}>
          Py
        </span>
      );
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <Image className={`${className} text-[#b388ff] shrink-0`} />;
    case 'svg':
      return <FileCode2 className={`${className} text-[#ff9800] shrink-0`} />;
    case 'sh':
    case 'bash':
      return <Terminal className={`${className} text-[#4caf50] shrink-0`} />;
    case 'env':
    case 'config':
    case 'lock':
      return <Settings className={`${className} text-[#80cbc4] shrink-0`} />;
    case 'rs':
      return <Flame className={`${className} text-[#dea584] shrink-0`} />;
    default:
      return <FileText className={`${className} text-[#90a4ae] shrink-0`} />;
  }
};
