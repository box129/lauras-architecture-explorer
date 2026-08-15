import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, FolderSearch, Library, Menu, Network, Settings as SettingsIcon } from 'lucide-react';
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
  onOpenLenses?: () => void;
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
  onOpenLenses,
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
        {/* Global navigation (Architecture / Documentation / Settings /
            Analyze another repository) and architectural-history Back are
            separate concepts and must both stay reachable at every depth:
            Back alone used to replace the hamburger entirely once the user
            had any history, which made Settings/Docs/Analyze-another-repo
            unreachable without backing out to repository root first. */}
        {canGoBack && (
          <button
            className="obs-icon-button"
            type="button"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        )}
        <div className="obs-topbar__nav-anchor" ref={navigationRef}>
          <button
            aria-controls="observatory-navigation-menu"
            aria-expanded={navigationOpen}
            aria-haspopup="menu"
            className="obs-icon-button"
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            <Menu size={18} strokeWidth={1.8} />
          </button>
          {navigationOpen && (
            <div className="obs-topbar__nav-menu" id="observatory-navigation-menu" role="menu" aria-label="Repository navigation">
              <div className="obs-topbar__nav-current" role="presentation">
                <Network size={15} />
                <span><strong>Architecture</strong><small>Explore the recovered structure</small></span>
              </div>
              <button type="button" role="menuitem" onClick={() => { setNavigationOpen(false); onOpenDocs(); }}>
                <BookOpen size={15} />
                <span><strong>Documentation / Doc Studio</strong><small>Browse components and source</small></span>
              </button>
              {onOpenLenses && (
                <button type="button" role="menuitem" onClick={() => { setNavigationOpen(false); onOpenLenses(); }}>
                  <Library size={15} />
                  <span><strong>Lenses & tours</strong><small>Saved views and walkthroughs</small></span>
                </button>
              )}
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
