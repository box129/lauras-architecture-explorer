import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, FolderSearch, Menu, Settings as SettingsIcon } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import BreadcrumbTrail, { type BreadcrumbItem } from './BreadcrumbTrail';
import RunPicker from './RunPicker';

interface ObservatoryTopBarProps {
  breadcrumb: BreadcrumbItem[];
  repoTitle: string;
  runId: string;
  freshness: string;
  lastScanned: string;
  canGoBack?: boolean;
  onBack?: () => void;
  onBreadcrumbSelect?: (index: number) => void;
  onOpenDocs: () => void;
  onAnalyzeAnotherRepository: () => void;
}

export default function ObservatoryTopBar({
  breadcrumb,
  repoTitle,
  runId,
  freshness,
  lastScanned,
  canGoBack = false,
  onBack,
  onBreadcrumbSelect,
  onOpenDocs,
  onAnalyzeAnotherRepository,
}: ObservatoryTopBarProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const openSettings = useSyntaxTreeStore((s) => s.openSettings);

  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) setNavigationOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [navigationOpen]);

  return (
    <header className="obs-topbar">
      <div className="obs-topbar__left">
        {/* Generic "Back" rather than "...previous architecture lens": this
            control now pops exactly one level of Evidence -> Entity ->
            Group -> Overview (unifiedBack in ObservatoryShell), not only
            lens/area levels, so a label naming one specific level would
            undersell what it does from Evidence or Entity Focus. */}
        <div className="obs-topbar__nav-anchor" ref={navigationRef}>
          <button
            aria-controls={canGoBack ? undefined : 'observatory-navigation-menu'}
            aria-expanded={canGoBack ? undefined : navigationOpen}
            aria-haspopup={canGoBack ? undefined : 'menu'}
            className="obs-icon-button"
            type="button"
            aria-label={canGoBack ? 'Back' : 'Open navigation'}
            onClick={canGoBack ? onBack : () => setNavigationOpen((open) => !open)}
          >
            {canGoBack ? <ArrowLeft size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
          </button>
          {!canGoBack && navigationOpen && (
            <div className="obs-topbar__nav-menu" id="observatory-navigation-menu" role="menu" aria-label="Repository navigation">
              <button type="button" role="menuitem" onClick={() => { setNavigationOpen(false); onOpenDocs(); }}>
                <BookOpen size={15} />
                <span><strong>Repository documentation</strong><small>Browse components and source</small></span>
              </button>
              <button type="button" role="menuitem" onClick={() => { setNavigationOpen(false); onAnalyzeAnotherRepository(); }}>
                <FolderSearch size={15} />
                <span><strong>Analyze another repository</strong><small>Clear this session and start again</small></span>
              </button>
              <button type="button" role="menuitem" onClick={() => { setNavigationOpen(false); openSettings(); }}>
                <SettingsIcon size={15} />
                <span><strong>Settings</strong><small>Configure architectural explanations</small></span>
              </button>
            </div>
          )}
        </div>
        <BreadcrumbTrail items={breadcrumb} onSelect={onBreadcrumbSelect} />
      </div>

      <div className="obs-topbar__title">{repoTitle}</div>

      <div className="obs-topbar__right">
        <RunPicker runId={runId} freshness={freshness} lastScanned={lastScanned} />
      </div>
    </header>
  );
}
