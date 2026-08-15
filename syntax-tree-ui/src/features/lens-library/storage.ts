import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocsStudioDraft, LensTour, SavedLens } from './types';

const LENSES_KEY = 'syntax-tree.observatory.savedLenses.v1';
const TOURS_KEY = 'syntax-tree.observatory.lensTours.v1';
const DRAFTS_KEY = 'syntax-tree.observatory.docsDrafts.v1';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLensLibrary(scopeKey: string) {
  const [lenses, setLenses] = useState<SavedLens[]>(() => readJson<SavedLens[]>(LENSES_KEY, []));
  const [tours, setTours] = useState<LensTour[]>(() => readJson<LensTour[]>(TOURS_KEY, []));
  const [drafts, setDrafts] = useState<DocsStudioDraft[]>(() => readJson<DocsStudioDraft[]>(DRAFTS_KEY, []));

  useEffect(() => writeJson(LENSES_KEY, lenses), [lenses]);
  useEffect(() => writeJson(TOURS_KEY, tours), [tours]);
  useEffect(() => writeJson(DRAFTS_KEY, drafts), [drafts]);

  const scopedLenses = useMemo(() => lenses.filter((lens) => lens.scopeKey === scopeKey), [lenses, scopeKey]);
  const scopedTours = useMemo(() => tours.filter((tour) => tour.scopeKey === scopeKey), [scopeKey, tours]);
  const scopedDrafts = useMemo(() => drafts.filter((draft) => draft.scopeKey === scopeKey), [drafts, scopeKey]);

  const saveLens = useCallback((lens: SavedLens) => {
    setLenses((current) => [lens, ...current.filter((item) => item.id !== lens.id)]);
  }, []);

  const renameLens = useCallback((id: string, title: string) => {
    setLenses((current) => current.map((lens) => lens.id === id ? { ...lens, title } : lens));
  }, []);

  const duplicateLens = useCallback((id: string) => {
    setLenses((current) => {
      const original = current.find((lens) => lens.id === id);
      if (!original) return current;
      return [{ ...original, id: createId('lens'), title: `${original.title} copy`, createdAt: new Date().toISOString() }, ...current];
    });
  }, []);

  const deleteLens = useCallback((id: string) => {
    setLenses((current) => current.filter((lens) => lens.id !== id));
    setTours((current) => current.map((tour) => ({ ...tour, lensIds: tour.lensIds.filter((lensId) => lensId !== id), updatedAt: new Date().toISOString() })));
  }, []);

  const saveTour = useCallback((tour: LensTour) => {
    setTours((current) => [tour, ...current.filter((item) => item.id !== tour.id)]);
  }, []);

  const updateTour = useCallback((tour: LensTour) => {
    setTours((current) => current.map((item) => item.id === tour.id ? { ...tour, updatedAt: new Date().toISOString() } : item));
  }, []);

  const deleteTour = useCallback((id: string) => {
    setTours((current) => current.filter((tour) => tour.id !== id));
  }, []);

  const saveDraft = useCallback((draft: DocsStudioDraft) => {
    setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
  }, []);

  return {
    lenses: scopedLenses,
    tours: scopedTours,
    drafts: scopedDrafts,
    saveLens,
    renameLens,
    duplicateLens,
    deleteLens,
    saveTour,
    updateTour,
    deleteTour,
    saveDraft,
  };
}
