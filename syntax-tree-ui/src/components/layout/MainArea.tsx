import { lazy, Suspense, useState, useCallback } from 'react';
import { useSyntaxTreeStore } from '../../store';
import LoadingSpinner from '../shared/LoadingSpinner';
import NodeInspector from '../inspector/NodeInspector';
import QueryPanel from '../query/QueryPanel';

const ArchitectureView = lazy(() => import('../architecture/ArchitectureView'));
const CodeViewer = lazy(() => import('../code/CodeViewer'));
const DocumentationSurface = lazy(() => import('../docs/DocumentationSurface'));
const Dashboard = lazy(() => import('../dashboard/Dashboard'));

const FALLBACK = <LoadingSpinner className="flex-1" size={32} />;

export default function MainArea() {
  const mainSurface = useSyntaxTreeStore((s) => s.mainSurface);
  const sidePanel = useSyntaxTreeStore((s) => s.sidePanel);
  const [sidePanelWidth, setSidePanelWidth] = useState(() => {
    // Default to 380px, but cap at 40% of window width
    return Math.min(380, Math.floor(window.innerWidth * 0.4));
  });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidePanelWidth;

    const onMove = (me: MouseEvent) => {
      const delta = startX - me.clientX;
      setSidePanelWidth(Math.max(280, Math.min(600, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidePanelWidth]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main surface */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Suspense fallback={FALLBACK}>
          {mainSurface === 'architecture' && <ArchitectureView />}
          {mainSurface === 'code' && <CodeViewer />}
          {mainSurface === 'docs' && <DocumentationSurface />}
          {mainSurface === 'dashboard' && <Dashboard />}
        </Suspense>
      </div>

      {/* Resize handle */}
      {sidePanel !== 'none' && (
        <div
          className="w-1 bg-border hover:bg-accent/50 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleDragStart}
        />
      )}

      {/* Side panel */}
      {sidePanel !== 'none' && (
        <div className="shrink-0 overflow-hidden bg-surface border-l border-border" style={{ width: sidePanelWidth, maxWidth: '50%' }}>
          {sidePanel === 'inspector' && <NodeInspector />}
          {sidePanel === 'query' && <QueryPanel />}
        </div>
      )}
    </div>
  );
}
