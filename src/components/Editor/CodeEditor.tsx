import React, { useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const CodeEditor: React.FC = () => {
  const {
    activeFile,
    updateFileContent,
    saveCurrentFile,
    setCursorPos,
    theme
  } = useWorkspace();

  const editorRef = useRef<any>(null);

  if (!activeFile) return null;

  // Map our app themes to Monaco theme strings
  const getMonacoTheme = (): string => {
    switch (theme) {
      case 'light-plus':
        return 'vs';
      case 'high-contrast':
        return 'hc-black';
      case 'dark-modern':
      case 'vscode-dark':
      case 'monokai':
      default:
        return 'vs-dark';
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position
    editor.onDidChangeCursorPosition(e => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column
      });
    });

    // Custom Ctrl+S / Cmd+S save command inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentFile();
    });

    // Custom format command
    editor.addCommand(
      monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run();
      }
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#1e1e1e]">
      <Editor
        key={activeFile.path}
        height="100%"
        width="100%"
        path={activeFile.path}
        language={activeFile.language || 'plaintext'}
        value={activeFile.content || ''}
        theme={getMonacoTheme()}
        onChange={value => {
          if (value !== undefined) {
            updateFileContent(activeFile.path, value);
          }
        }}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineHeight: 21,
          minimap: {
            enabled: true,
            side: 'right',
            showSlider: 'mouseover',
            renderCharacters: false
          },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false
          },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true
          },
          guides: {
            bracketPairs: true,
            indentation: true
          },
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          wordWrap: 'off',
          padding: { top: 8 }
        }}
        loading={
          <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-[#858585] text-xs">
            Loading Monaco Editor...
          </div>
        }
      />
    </div>
  );
};
