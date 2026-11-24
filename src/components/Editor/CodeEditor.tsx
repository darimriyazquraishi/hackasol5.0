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
      case 'monokai':
        return 'vs-dark';
      case 'vscode-dark':
        return 'vs-dark';
      case 'dark-modern':
      default:
        return 'lumi-dark';
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define authoritative LUMI dark theme matching the luxury palette
    monaco.editor.defineTheme('lumi-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'd5d2cc', background: '080808' },
        { token: 'comment', foreground: '765b43', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'b89774', fontStyle: 'bold' },
        { token: 'string', foreground: 'c4a480' },
        { token: 'number', foreground: 'dfb15b' },
        { token: 'type', foreground: 'eed292' },
        { token: 'identifier', foreground: 'f5f4f1' },
        { token: 'delimiter', foreground: '9c9c9c' }
      ],
      colors: {
        'editor.background': '#080808',
        'editor.foreground': '#d5d2cc',
        'editorCursor.foreground': '#987654',
        'editor.lineHighlightBackground': '#121212',
        'editorLineNumber.foreground': '#404040',
        'editorLineNumber.activeForeground': '#987654',
        'editor.selectionBackground': '#98765433',
        'editor.inactiveSelectionBackground': '#9876541a',
        'editorIndentGuide.background': '#202020',
        'editorIndentGuide.activeBackground': '#98765466',
        'editorGutter.background': '#080808',
        'editorWidget.background': '#121212',
        'editorWidget.border': '#303030',
        'editorSuggestWidget.background': '#121212',
        'editorSuggestWidget.border': '#303030',
        'editorSuggestWidget.selectedBackground': '#191919'
      }
    });

    if (!theme || theme === 'dark-modern') {
      monaco.editor.setTheme('lumi-dark');
    }

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
    <div className="w-full h-full relative overflow-hidden bg-[#080808]">
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
          <div className="w-full h-full flex items-center justify-center bg-[#080808] text-[#9C9C9C] text-xs">
            Loading Monaco Editor...
          </div>
        }
      />
    </div>
  );
};
