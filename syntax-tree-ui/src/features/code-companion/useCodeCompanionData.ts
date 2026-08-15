import { useCallback, useEffect, useState } from 'react';
import type {
  CodeCompanionSelection,
  FileContentResponse,
  ImplementationSliceDTO,
} from '../architecture-map/apiTypes';
import { getFileContent, getImplementationSlice } from '../architecture-map/lensCache';
import { getFixtureFileContent, getFixtureImplementationSlice } from '../observatory/fixtures/openWebuiImplementation';

interface CodeCompanionData {
  slice: ImplementationSliceDTO | null;
  fileContent: FileContentResponse | null;
  activeFilePath: string;
  activeSpanId: string;
  loading: boolean;
  fileLoading: boolean;
  error: string | null;
}

export function useCodeCompanionData(
  selection: CodeCompanionSelection | null,
  enabled: boolean,
  source: 'api' | 'fixture',
  previewState: string,
): CodeCompanionData {
  const [slice, setSlice] = useState<ImplementationSliceDTO | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFilePath = (() => {
    if (!slice) return selection?.file_path ?? '';
    if (selection?.file_path && slice.tabs.some((tab) => tab.file_path === selection.file_path)) return selection.file_path;
    const spanMatch = selection?.span_id
      ? slice.tabs.find((tab) => tab.highlights.some((highlight) => highlight.span_id === selection.span_id))
      : null;
    return spanMatch?.file_path ?? slice.tabs[0]?.file_path ?? selection?.file_path ?? '';
  })();

  const activeSpanId = (() => {
    if (selection?.span_id) return selection.span_id;
    if (!slice) return '';
    const activeTab = slice.tabs.find((tab) => tab.file_path === activeFilePath) ?? slice.tabs[0];
    return slice.primary_span_id || activeTab?.highlights[0]?.span_id || '';
  })();

  const loadSlice = useCallback(async (isCancelled: () => boolean) => {
    if (!enabled || !selection?.subject_type || !selection.subject_id) {
      return;
    }
    setLoading(true);
    setError(null);
    const request = source === 'fixture'
      ? Promise.resolve(getFixtureImplementationSlice(selection, previewState))
      : getImplementationSlice(selection.subject_type, selection.subject_id);
    try {
      const nextSlice = await request;
      if (!isCancelled()) setSlice(nextSlice);
    } catch (err) {
      if (isCancelled()) return;
      setSlice(null);
      setError(err instanceof Error ? err.message : 'Implementation slice request failed');
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [enabled, previewState, selection, source]);

  useEffect(() => {
    let cancelled = false;
    void loadSlice(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadSlice]);

  const loadFile = useCallback(async (isCancelled: () => boolean) => {
    if (!enabled || !activeFilePath || !slice?.tabs.length) {
      setFileLoading(false);
      return;
    }
    if (source === 'fixture') {
      setFileLoading(false);
      setFileContent(getFixtureFileContent(activeFilePath));
      return;
    }
    setFileLoading(true);
    const request = getFileContent(activeFilePath);
    try {
      const content = await request;
      if (!isCancelled()) setFileContent(content);
    } catch (err) {
      if (isCancelled()) return;
      setFileContent(null);
      setError(err instanceof Error ? err.message : 'File content request failed');
    } finally {
      setFileLoading(false);
    }
  }, [activeFilePath, enabled, slice?.tabs.length, source]);

  useEffect(() => {
    let cancelled = false;
    void loadFile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadFile]);

  if (!enabled || !selection?.subject_type || !selection.subject_id) {
    return { slice: null, fileContent: null, activeFilePath: '', activeSpanId: '', loading: false, fileLoading: false, error: null };
  }
  return { slice, fileContent, activeFilePath, activeSpanId, loading, fileLoading, error };
}
