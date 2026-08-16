import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef } from 'react';
import type { editor as monacoEditor } from 'monaco-editor';
import type {
  FileContentResponse,
  ImplementationHighlightDTO,
} from '../architecture-map/apiTypes';

interface ObservatoryMonacoProps {
  fileContent: FileContentResponse;
  highlights: ImplementationHighlightDTO[];
  activeSpanId: string;
}

function languageFromPath(path: string, fallback: string) {
  if (fallback && fallback !== 'unknown') return fallback;
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'py') return 'python';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (ext === 'css') return 'css';
  return 'plaintext';
}

export default function ObservatoryMonaco({ fileContent, highlights, activeSpanId }: ObservatoryMonacoProps) {
  const monaco = useMonaco();
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monacoEditor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!monaco) return;
    // The code surface is a dark panel in BOTH product themes
    // (THEME_SYSTEM: background.code #171821 light / #101018 dark) — the
    // paper shell frames a dark source pane, so evidence highlights keep
    // one consistent recipe everywhere.
    monaco.editor.defineTheme('syntax-tree-observatory', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'AAA7B2', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8FB0D9' },
        { token: 'string', foreground: '97BE81' },
        { token: 'number', foreground: 'D28C64' },
        { token: 'type', foreground: '8FB0D9' },
        { token: 'function', foreground: 'D9B84A' },
        { token: 'variable', foreground: 'ECEAF0' },
      ],
      colors: {
        'editor.background': '#171821',
        'editor.foreground': '#ECEAF0',
        'editor.lineHighlightBackground': '#1D1E29',
        'editor.selectionBackground': '#8FB0D930',
        'editor.inactiveSelectionBackground': '#8FB0D91A',
        'editorLineNumber.foreground': '#6F6C78',
        'editorLineNumber.activeForeground': '#8FB0D9',
        'editorGutter.background': '#171821',
        'editorCursor.foreground': '#8FB0D9',
        'scrollbarSlider.background': '#3A3B4A80',
        'scrollbarSlider.hoverBackground': '#4A4B5A80',
        'editorOverviewRuler.border': '#2A2B38',
      },
    });
    // The Editor can mount before this definition exists (monaco falls back
    // to its default light theme and never re-reads the name) — apply
    // explicitly once defined.
    monaco.editor.setTheme('syntax-tree-observatory');
  }, [monaco]);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    decorationsRef.current?.clear();
    decorationsRef.current = editor.createDecorationsCollection(highlights.map((highlight) => {
      const active = highlight.span_id === activeSpanId;
      return {
        range: {
          startLineNumber: highlight.start_line,
          startColumn: 1,
          endLineNumber: highlight.end_line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: active ? 'obs-code-highlight obs-code-highlight--active' : 'obs-code-highlight',
          glyphMarginClassName: highlight.status === 'stale' ? 'obs-code-glyph obs-code-glyph--stale' : 'obs-code-glyph',
          hoverMessage: { value: `Source proof: ${highlight.span_id}` },
          overviewRuler: {
            color: active ? '#3D5A80' : '#C9A227',
            position: 1,
          },
        },
      };
    }));
  }, [activeSpanId, highlights]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const target = highlights.find((highlight) => highlight.span_id === activeSpanId) ?? highlights[0];
    if (!target) return;
    editor.revealLineInCenter(target.start_line, 0);
  }, [activeSpanId, fileContent.file_path, highlights]);

  return (
    <Editor
      height="100%"
      language={languageFromPath(fileContent.file_path, fileContent.language)}
      loading={<div className="obs-code-loading">Reading source file...</div>}
      onMount={handleMount}
      options={{
        readOnly: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        renderLineHighlight: 'gutter',
        glyphMargin: true,
        folding: true,
        automaticLayout: true,
        wordWrap: 'off',
        padding: { top: 14, bottom: 14 },
      }}
      theme="syntax-tree-observatory"
      value={fileContent.content}
    />
  );
}
