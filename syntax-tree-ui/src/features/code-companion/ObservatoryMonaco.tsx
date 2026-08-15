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
    monaco.editor.defineTheme('syntax-tree-observatory', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8F8A82', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3D5A80' },
        { token: 'string', foreground: '7A9B68' },
        { token: 'number', foreground: 'A0522D' },
        { token: 'type', foreground: '3D5A80' },
        { token: 'function', foreground: '8A6E1B' },
        { token: 'variable', foreground: '1A1916' },
      ],
      colors: {
        'editor.background': '#FCFAF7',
        'editor.foreground': '#1A1916',
        'editor.lineHighlightBackground': '#F8F5F1',
        'editor.selectionBackground': '#3D5A8024',
        'editor.inactiveSelectionBackground': '#3D5A8014',
        'editorLineNumber.foreground': '#9A9890',
        'editorLineNumber.activeForeground': '#3D5A80',
        'editorGutter.background': '#FCFAF7',
        'editorCursor.foreground': '#3D5A80',
        'scrollbarSlider.background': '#DED8CF80',
        'scrollbarSlider.hoverBackground': '#C8C0B680',
        'editorOverviewRuler.border': '#DED8CF',
      },
    });
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
