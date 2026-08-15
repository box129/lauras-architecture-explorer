import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '../../api/hooks';
import { useSyntaxTreeStore } from '../../store';
import LoadingSpinner from '../shared/LoadingSpinner';

interface SearchDialogProps {
  onClose: () => void;
}

export default function SearchDialog({ onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);

  const { data, loading } = useSearch(query.length >= 2 ? query : null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Global Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[560px] max-h-[60vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes, functions, classes..."
            className="flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-secondary/60"
          />
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {loading && <LoadingSpinner className="py-8" />}
          {!loading && data && data.results.length === 0 && query.length >= 2 && (
            <div className="text-center text-secondary text-sm py-8">No results found</div>
          )}
          {!loading && data?.results.map((node) => (
            <button
              key={node.qualified_name}
              className="w-full text-left px-4 py-2.5 hover:bg-bg/60 transition-colors border-b border-border/50"
              onClick={() => {
                selectNode(node.qualified_name);
                if (node.file_path && node.line_start) {
                  goToCode(node.file_path, node.line_start);
                }
                onClose();
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-secondary font-mono">
                  {node.type}
                </span>
                <span className="text-sm font-medium text-primary">{node.name}</span>
              </div>
              {node.snippet && (
                <div className="text-xs text-secondary mt-0.5 truncate">{node.snippet}</div>
              )}
              <div className="text-[10px] text-secondary/60 mt-0.5 font-mono">{node.file_path}:{node.line_start}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
