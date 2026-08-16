import { useEffect, useRef, useCallback, useState } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import type { editor as monacoEditor } from 'monaco-editor';
import { syntaxTreeDarkTheme, monacoOptions } from './monacoTheme';
import type { FileContentResponse } from '../../api/types';
import LoadingSpinner from '../shared/LoadingSpinner';

interface MonacoWrapperProps {
  fileContent: FileContentResponse;
  targetLine: number | null;
  /** End of the cited span, when navigation targets a multi-line range
   * (e.g. an evidence-chain citation). Defaults to `targetLine` when
   * omitted or not >= targetLine -- never fabricated beyond what the
   * caller actually supplied. */
  targetLineEnd?: number | null;
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'sql': return 'sql';
    case 'json': return 'json';
    case 'yaml': case 'yml': return 'yaml';
    case 'md': return 'markdown';
    case 'css': return 'css';
    case 'html': return 'html';
    default: return 'plaintext';
  }
}

const ENTITY_COLORS: Record<string, string> = {
  function: 'rgba(124, 77, 255, 0.06)',
  method: 'rgba(124, 77, 255, 0.06)',
  class: 'rgba(66, 165, 245, 0.06)',
  module: 'rgba(76, 175, 80, 0.04)',
};

export default function MonacoWrapper({ fileContent, targetLine, targetLineEnd = null }: MonacoWrapperProps) {
  const monaco = useMonaco();
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monacoEditor.IEditorDecorationsCollection | null>(null);
  const highlightDecorationsRef = useRef<monacoEditor.IEditorDecorationsCollection | null>(null);
  // editorRef alone can't drive the reveal effect below: a ref update
  // doesn't trigger a re-run of effects depending only on [targetLine].
  // Without this, a caller that mounts CodeViewer with targetLine ALREADY
  // set on the very first render (e.g. "Open source" opening a fresh
  // overlay -- openFilePath/openFileLine are set together, before Monaco
  // has even loaded) hits the effect while editorRef.current is still
  // null, bails out via the `!editor` guard, and never retries once
  // handleMount actually fires -- the editor silently stays scrolled to
  // line 1 instead of the requested line.
  const [editorReady, setEditorReady] = useState(false);

  // Register custom theme. setTheme is applied explicitly because the
  // Editor can mount before this definition exists, in which case Monaco
  // silently falls back to its default LIGHT theme and never re-reads the
  // name (the white source pane seen in the exact-source overlay).
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('syntax-tree-dark', syntaxTreeDarkTheme);
      monaco.editor.setTheme('syntax-tree-dark');
    }
  }, [monaco]);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    setEditorReady(true);
  }, []);

  // Apply entity decorations
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !fileContent.entities) return;

    const model = editor.getModel();
    if (!model) return;

    const decorations: monacoEditor.IModelDeltaDecoration[] = fileContent.entities.map((entity) => ({
      range: {
        startLineNumber: entity.line_start,
        startColumn: 1,
        endLineNumber: entity.line_end,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: `entity-decoration-${entity.type}`,
        glyphMarginClassName: `entity-glyph-${entity.type}`,
        overviewRuler: {
          color: entity.type === 'class' ? '#42A5F5' : '#7C4DFF',
          position: 1,
        },
        hoverMessage: {
          value: `**${entity.type}** \`${entity.name}\`\n\n${entity.qualified_name}`,
        },
        minimap: {
          color: entity.type === 'class' ? '#42A5F540' : '#7C4DFF40',
          position: 1,
        },
      },
    }));

    // Clean up previous decorations
    decorationsRef.current?.clear();
    decorationsRef.current = editor.createDecorationsCollection(decorations);
  }, [fileContent, editorReady]);

  // Navigation / evidence-span highlight.
  //
  // Persistent, not a timed flash: the previous implementation cleared this
  // decoration via `setTimeout(..., 1500)`, which meant a user who took
  // more than ~1.5s to actually find and read the target line (the normal
  // case for a real function) saw no highlight at all by the time they
  // looked -- confirmed live in the Claude Design UX audit (finding F04,
  // `qa-audit/claude-design-ux-review/`). The highlight now persists until
  // the target changes (or the file/editor unmounts), so it survives
  // however long it takes Monaco to finish loading and however long the
  // user takes to look. Never fabricated: bails out entirely when there is
  // no real targetLine, so a missing/unresolved source span never gets an
  // invented highlight.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !targetLine || targetLine < 1) {
      highlightDecorationsRef.current?.clear();
      return;
    }

    const endLine = targetLineEnd && targetLineEnd >= targetLine ? targetLineEnd : targetLine;

    editor.revealLineInCenter(targetLine);

    highlightDecorationsRef.current?.clear();
    highlightDecorationsRef.current = editor.createDecorationsCollection([
      {
        range: {
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'nav-highlight-line',
          linesDecorationsClassName: 'nav-highlight-gutter',
          overviewRuler: { color: '#e6b800', position: 4 },
        },
      },
    ]);

    return () => {
      highlightDecorationsRef.current?.clear();
      highlightDecorationsRef.current = null;
    };
  }, [targetLine, targetLineEnd, editorReady]);

  // Inject CSS for entity decorations + the evidence-span highlight.
  //
  // The highlight now PERSISTS (see the effect above) -- it does not fade
  // to nothing. The animation below is a brief attention pulse on arrival
  // that settles into, and stays at, the same visible tint declared on the
  // base `.nav-highlight-line` rule (no `forwards` needed: without it, a
  // finished CSS animation simply reverts to the element's own declared,
  // non-animated property values, which already equal the animation's end
  // state here).
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = Object.entries(ENTITY_COLORS)
      .map(([type, color]) => `.entity-decoration-${type} { background: ${color}; }`)
      .join('\n') +
      '\n.nav-highlight-line { background: hsla(45, 90%, 50%, 0.22); animation: nav-highlight-pulse 1.2s ease-out; }' +
      '\n.nav-highlight-gutter { border-left: 3px solid hsla(45, 90%, 40%, 0.9); }' +
      '\n@keyframes nav-highlight-pulse { 0% { background: hsla(45, 95%, 50%, 0.5); } 100% { background: hsla(45, 90%, 50%, 0.22); } }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <Editor
      height="100%"
      language={languageFromPath(fileContent.file_path)}
      value={fileContent.content}
      options={monacoOptions}
      theme="syntax-tree-dark"
      onMount={handleMount}
      loading={<LoadingSpinner className="flex-1" size={24} />}
    />
  );
}
