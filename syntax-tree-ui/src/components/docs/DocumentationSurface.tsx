import { useState, useCallback } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { useDocTOC, useDocSection } from '../../api/hooks';
import DocTOC from './DocTOC';
import DocContent from './DocContent';
import GenerateDialog from './GenerateDialog';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorBanner from '../shared/ErrorBanner';

export default function DocumentationSurface() {
  const [selectedQN, setSelectedQN] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: tocData, loading: tocLoading, error: tocError, refetch: refetchTOC } = useDocTOC();
  const { data: section, loading: sectionLoading, refetch: refetchSection } = useDocSection(selectedQN);

  const [tocWidth, setTocWidth] = useState(250);

  const handleTocDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = tocWidth;
    const onMove = (me: MouseEvent) => {
      setTocWidth(Math.max(180, Math.min(400, startWidth + (me.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [tocWidth]);

  const handleGenerated = (qn: string) => {
    setSelectedQN(qn);
    refetchTOC();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 bg-surface border-b border-border flex items-center px-3 gap-2 shrink-0">
        <FileText size={14} className="text-secondary" />
        <span className="text-xs text-secondary font-medium">Documentation</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-secondary bg-bg border border-border rounded hover:text-primary hover:bg-border/50 transition-colors"
        >
          <Sparkles size={12} /> Generate
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* TOC */}
        <div className="bg-surface border-r border-border shrink-0 overflow-hidden" style={{ width: tocWidth }}>
          {tocLoading ? (
            <LoadingSpinner className="py-8" />
          ) : tocError ? (
            <div className="p-2"><ErrorBanner message={tocError} onRetry={refetchTOC} /></div>
          ) : (
            <DocTOC
              sections={tocData?.sections || []}
              selectedQN={selectedQN}
              onSelect={setSelectedQN}
            />
          )}
        </div>

        {/* Resize handle */}
        <div
          className="w-1 bg-border hover:bg-accent/50 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleTocDrag}
        />

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!selectedQN ? (
            <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 px-6 text-center">
              <FileText size={40} className="opacity-30" />
              <p className="text-sm">
                {tocData?.sections?.length ? 'Select a stored artifact from the table of contents' : 'No documentation artifacts have been created'}
              </p>
              <button
                onClick={() => setShowGenerate(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-accent rounded hover:bg-accent/90 transition-colors"
              >
                <Sparkles size={13} /> Create Artifact
              </button>
            </div>
          ) : sectionLoading ? (
            <LoadingSpinner className="h-full" size={24} />
          ) : section ? (
            <DocContent section={section} onRefresh={refetchSection} />
          ) : (
            <div className="p-4"><ErrorBanner message="Section not found" /></div>
          )}
        </div>
      </div>

      {showGenerate && (
        <GenerateDialog
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}
