import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, FolderSearch, GitBranch, Library, Menu, Network, Search, Settings as SettingsIcon } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import ThemeToggle from '../../components/shared/ThemeToggle';
import BreadcrumbTrail, { type BreadcrumbItem } from './BreadcrumbTrail';
import RunPicker from './RunPicker';

export interface ArchitectureSearchItem {
  id: string;
  label: string;
  path: string;
  kind: string;
}

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
  searchItems?: ArchitectureSearchItem[];
  onSearchSelect?: (item: ArchitectureSearchItem) => void;
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
  searchItems,
  onSearchSelect,
}: ObservatoryTopBarProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const openSettings = useSyntaxTreeStore((s) => s.openSettings);

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !searchItems?.length) return [];
    return searchItems
      .filter((item) => item.label.toLowerCase().includes(query) || item.path.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchItems, searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    return () => document.removeEventListener('pointerdown', closeOnPointerDown);
  }, [searchOpen]);

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
        <div className="obs-topbar__brand" aria-label="Laura's">
          <GitBranch size={16} strokeWidth={1.9} />
          <span>Laura&rsquo;s</span>
        </div>
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
        {searchItems && searchItems.length > 0 && onSearchSelect && (
          <div className="obs-topbar__search" ref={searchRef}>
            <Search size={13} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              placeholder="Find a module, cluster or region"
              aria-label="Find a module, cluster or region"
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchMatches[0]) {
                  onSearchSelect(searchMatches[0]);
                  setSearchOpen(false);
                  setSearchQuery('');
                }
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />
            {searchOpen && searchMatches.length > 0 && (
              <ul className="obs-topbar__search-results" role="listbox" aria-label="Architecture search results">
                {searchMatches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSearchSelect(item);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span>{item.label}</span>
                      <small>{item.kind} · {item.path}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <ThemeToggle />
        <RunPicker runId={runId} freshness={freshness} lastScanned={lastScanned} />
      </div>
    </header>
  );
}
