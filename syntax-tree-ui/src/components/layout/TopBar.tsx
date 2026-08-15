import { Search, GitBranch, RotateCcw } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import type { MainSurface } from '../../store';
import { useApiGet } from '../../api/hooks';
import type { ArchitectureOverview } from '../../api/types';
import { useState } from 'react';
import SearchDialog from './SearchDialog';

const NAV_TABS: { value: MainSurface; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'code', label: 'Code' },
  { value: 'docs', label: 'Docs' },
];

export default function TopBar() {
  const mainSurface = useSyntaxTreeStore((s) => s.mainSurface);
  const setMainSurface = useSyntaxTreeStore((s) => s.setMainSurface);
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const sidePanel = useSyntaxTreeStore((s) => s.sidePanel);
  const setSidePanel = useSyntaxTreeStore((s) => s.setSidePanel);
  const resetAnalysis = useSyntaxTreeStore((s) => s.resetAnalysis);
  const { data: overview } = useApiGet<ArchitectureOverview>(
    analysisStatus === 'completed' ? '/architecture/overview' : null
  );
  const [searchOpen, setSearchOpen] = useState(false);

  const healthScore = overview?.health_score ?? 0;
  const pulseSpeed = Math.max(1.5, 3 - healthScore * 1.5);

  return (
    <>
      <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-4 shrink-0">
        {/* Logo / Project Name */}
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-accent" />
          <span className="font-semibold text-sm text-primary">Syntax Tree</span>
        </div>

        {/* Health Badge */}
        {analysisStatus === 'completed' && (
          <div
            className="w-2.5 h-2.5 rounded-full bg-accent"
            style={{
              animation: `heartbeat ${pulseSpeed}s ease-in-out infinite`,
              '--pulse-scale': 1 + (1 - healthScore) * 0.15,
            } as React.CSSProperties}
            title={`Health: ${Math.round(healthScore * 100)}%`}
          />
        )}

        {/* Re-analyze (only when a run has finished) */}
        {(analysisStatus === 'completed' || analysisStatus === 'failed') && (
          <button
            onClick={() => {
              if (window.confirm('Re-analyze a different repository? Current results will be cleared.')) {
                resetAnalysis();
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-secondary hover:text-primary border border-border rounded hover:bg-bg transition-colors"
            title="Clear results and analyze another repository"
          >
            <RotateCcw size={11} />
            Re-analyze
          </button>
        )}

        {/* Nav Tabs */}
        <nav className="flex gap-1 ml-4">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMainSurface(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                mainSurface === tab.value
                  ? 'bg-bg text-primary border-b-2 border-accent'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Search Trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-secondary border border-border rounded hover:text-primary hover:bg-bg transition-colors"
        >
          <Search size={13} />
          <span>Search</span>
          <kbd className="text-[10px] text-secondary/60 ml-1">Ctrl+K</kbd>
        </button>

        {/* Side panel toggles */}
        <div className="flex gap-1">
          <button
            onClick={() => setSidePanel(sidePanel === 'inspector' ? 'none' : 'inspector')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              sidePanel === 'inspector' ? 'bg-bg text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Inspector
          </button>
          <button
            onClick={() => setSidePanel(sidePanel === 'query' ? 'none' : 'query')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              sidePanel === 'query' ? 'bg-bg text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Query
          </button>
        </div>
      </header>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
