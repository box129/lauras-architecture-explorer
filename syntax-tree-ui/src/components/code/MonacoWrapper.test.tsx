import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonacoWrapper from './MonacoWrapper';
import type { FileContentResponse } from '../../api/types';

/**
 * Regression coverage for Claude Design UX audit finding F04: the source
 * viewer previously highlighted the cited evidence line/span with a
 * `setTimeout(..., 1500)` flash that had usually already faded by the time
 * a real user found the line in a real function -- confirmed live,
 * `qa-audit/claude-design-ux-review/findings.json` (F04). These tests
 * exercise the actual decoration logic in `MonacoWrapper` against a
 * lightweight fake editor, since the real Monaco editor doesn't run in
 * jsdom.
 */

const revealLineInCenter = vi.fn();
let lastCollectionCleared: (() => void)[] = [];

function makeFakeEditor() {
  const createDecorationsCollection = vi.fn((decorations: unknown[]) => {
    const collection = { clear: vi.fn(), decorations };
    lastCollectionCleared.push(collection.clear);
    return collection;
  });
  return {
    getModel: () => ({}),
    revealLineInCenter,
    createDecorationsCollection,
  };
}

let fakeEditor = makeFakeEditor();

function MockEditor({ onMount }: { onMount?: (editor: unknown) => void }) {
  useEffect(() => {
    onMount?.(fakeEditor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: MockEditor,
  useMonaco: () => null,
}));

vi.mock('./monacoTheme', () => ({ syntaxTreeDarkTheme: {}, monacoOptions: {} }));

function buildFileContent(): FileContentResponse {
  return {
    file_path: 'app.py',
    content: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n'),
    entities: [],
    line_count: 30,
    language: 'python',
  };
}

afterEach(() => {
  vi.clearAllMocks();
  lastCollectionCleared = [];
  fakeEditor = makeFakeEditor();
});

describe('MonacoWrapper evidence-span highlight', () => {
  it('applies a persistent decoration covering the exact cited line once the editor is ready', () => {
    render(<MonacoWrapper fileContent={buildFileContent()} targetLine={14} targetLineEnd={null} />);

    expect(fakeEditor.revealLineInCenter).toHaveBeenCalledWith(14);
    const calls = (fakeEditor.createDecorationsCollection as ReturnType<typeof vi.fn>).mock.calls;
    const highlightCall = calls.find((call) =>
      (call[0] as { options: { className: string } }[]).some((d) => d.options.className === 'nav-highlight-line'),
    );
    expect(highlightCall).toBeDefined();
    const decoration = (highlightCall![0] as { range: { startLineNumber: number; endLineNumber: number } }[])[0];
    expect(decoration.range.startLineNumber).toBe(14);
    expect(decoration.range.endLineNumber).toBe(14);

    // Never auto-cleared: this is the whole point of the fix -- no timer
    // should ever call the collection's own clear().
    expect(lastCollectionCleared[lastCollectionCleared.length - 1]).not.toHaveBeenCalled();
  });

  it('represents a multi-line evidence span accurately, not just its first line', () => {
    render(<MonacoWrapper fileContent={buildFileContent()} targetLine={10} targetLineEnd={13} />);

    const calls = (fakeEditor.createDecorationsCollection as ReturnType<typeof vi.fn>).mock.calls;
    const highlightCall = calls.find((call) =>
      (call[0] as { options: { className: string } }[]).some((d) => d.options.className === 'nav-highlight-line'),
    );
    const decoration = (highlightCall![0] as { range: { startLineNumber: number; endLineNumber: number } }[])[0];
    expect(decoration.range.startLineNumber).toBe(10);
    expect(decoration.range.endLineNumber).toBe(13);
  });

  it('follows a changed evidence span across a rerender', () => {
    const { rerender } = render(
      <MonacoWrapper fileContent={buildFileContent()} targetLine={5} targetLineEnd={null} />,
    );
    rerender(<MonacoWrapper fileContent={buildFileContent()} targetLine={20} targetLineEnd={22} />);

    expect(fakeEditor.revealLineInCenter).toHaveBeenLastCalledWith(20);
    const calls = (fakeEditor.createDecorationsCollection as ReturnType<typeof vi.fn>).mock.calls;
    const highlightCalls = calls.filter((call) =>
      (call[0] as { options: { className: string } }[]).some((d) => d.options.className === 'nav-highlight-line'),
    );
    const last = highlightCalls[highlightCalls.length - 1];
    const decoration = (last[0] as { range: { startLineNumber: number; endLineNumber: number } }[])[0];
    expect(decoration.range.startLineNumber).toBe(20);
    expect(decoration.range.endLineNumber).toBe(22);
    // The previous span's decoration collection must be cleared when the
    // target changes, so two highlights never linger on screen at once.
    expect(lastCollectionCleared[0]).toHaveBeenCalled();
  });

  it('never fabricates a highlight when there is no valid target line', () => {
    render(<MonacoWrapper fileContent={buildFileContent()} targetLine={null} targetLineEnd={null} />);

    expect(fakeEditor.revealLineInCenter).not.toHaveBeenCalled();
    const calls = (fakeEditor.createDecorationsCollection as ReturnType<typeof vi.fn>).mock.calls;
    const highlightCall = calls.find((call) =>
      (call[0] as { options: { className: string } }[]).some((d) => d.options.className === 'nav-highlight-line'),
    );
    expect(highlightCall).toBeUndefined();
  });
});
