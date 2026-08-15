import { useSyntaxTreeStore } from '../../store';
import { useNode, useApiGet } from '../../api/hooks';
import { buildQueryString } from '../../api/client';
import type { PaginatedEdges } from '../../api/types';
import { Code2, FileText, Zap, Info } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function NodeInspector() {
  const selectedQN = useSyntaxTreeStore((s) => s.selectedQN);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const goToDoc = useSyntaxTreeStore((s) => s.goToDoc);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);
  const setViewType = useSyntaxTreeStore((s) => s.setViewType);
  const setScopeQN = useSyntaxTreeStore((s) => s.setScopeQN);

  const { data: node, loading } = useNode(selectedQN);
  const { data: outEdges } = useApiGet<PaginatedEdges>(
    selectedQN ? `/edges${buildQueryString({ source_qn: selectedQN })}` : null
  );
  const { data: inEdges } = useApiGet<PaginatedEdges>(
    selectedQN ? `/edges${buildQueryString({ target_qn: selectedQN })}` : null
  );

  if (!selectedQN) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 p-4">
        <Info size={32} className="opacity-30" />
        <p className="text-sm text-center">Select a node to inspect its details</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner className="h-full" size={24} />;
  if (!node) return <div className="p-4 text-sm text-secondary">Node not found</div>;

  const callees = outEdges?.edges.filter((e) => e.edge_type === 'CALLS') || [];
  const callers = inEdges?.edges.filter((e) => e.edge_type === 'CALLS') || [];
  const imports = outEdges?.edges.filter((e) => e.edge_type === 'IMPORTS') || [];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-secondary font-mono uppercase">
            {node.type}
          </span>
          {node.is_async && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-interp/20 text-interp">async</span>
          )}
          {node.is_exported && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success">exported</span>
          )}
        </div>
        <h3 className="text-base font-semibold text-primary">{node.name}</h3>
        <p className="text-xs text-secondary font-mono mt-0.5">
          {node.file_path}:{node.line_start}-{node.line_end}
        </p>
      </div>

      {/* Details */}
      <div className="p-4 border-b border-border space-y-3">
        {node.docstring && (
          <div>
            <label className="text-[10px] text-secondary uppercase tracking-wide">Docstring</label>
            <p className="text-xs text-primary/80 mt-0.5 leading-relaxed">{node.docstring}</p>
          </div>
        )}

        {node.parameters.length > 0 && (
          <div>
            <label className="text-[10px] text-secondary uppercase tracking-wide">Parameters</label>
            <div className="mt-1 space-y-0.5">
              {node.parameters.map((p, i) => (
                <div key={i} className="text-xs font-mono text-primary/80">
                  <span className="text-info">{(p as Record<string, string>).name}</span>
                  {(p as Record<string, string>).type_annotation && (
                    <span className="text-secondary">: {(p as Record<string, string>).type_annotation}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {node.return_type && (
          <div>
            <label className="text-[10px] text-secondary uppercase tracking-wide">Returns</label>
            <p className="text-xs font-mono text-info mt-0.5">{node.return_type}</p>
          </div>
        )}

        {node.decorators.length > 0 && (
          <div>
            <label className="text-[10px] text-secondary uppercase tracking-wide">Decorators</label>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {node.decorators.map((d, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-interp/10 text-interp rounded font-mono">
                  @{d}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.superclasses.length > 0 && (
          <div>
            <label className="text-[10px] text-secondary uppercase tracking-wide">Superclasses</label>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {node.superclasses.map((sc, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-info/10 text-info rounded font-mono">
                  {sc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Relationships */}
      <div className="p-4 border-b border-border">
        <label className="text-[10px] text-secondary uppercase tracking-wide mb-2 block">Relationships</label>

        {callers.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] text-secondary">Called by ({callers.length})</span>
            <div className="mt-1 space-y-0.5">
              {callers.slice(0, 10).map((e, i) => (
                <button
                  key={`${e.source_qn}-${i}`}
                  onClick={() => selectNode(e.source_qn)}
                  className="block text-xs text-info hover:underline truncate w-full text-left font-mono"
                >
                  {e.source_qn.split(':').pop()?.replace(/\./g, ' > ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {callees.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] text-secondary">Calls ({callees.length})</span>
            <div className="mt-1 space-y-0.5">
              {callees.slice(0, 10).map((e, i) => (
                <button
                  key={`${e.target_qn}-${i}`}
                  onClick={() => selectNode(e.target_qn)}
                  className="block text-xs text-info hover:underline truncate w-full text-left font-mono"
                >
                  {e.target_qn.split(':').pop()?.replace(/\./g, ' > ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {imports.length > 0 && (
          <div>
            <span className="text-[10px] text-secondary">Imports ({imports.length})</span>
            <div className="mt-1 space-y-0.5">
              {imports.slice(0, 10).map((e, i) => (
                <button
                  key={`${e.target_qn}-${i}`}
                  onClick={() => selectNode(e.target_qn)}
                  className="block text-xs text-info hover:underline truncate w-full text-left font-mono"
                >
                  {e.target_qn.split(':').pop()}
                </button>
              ))}
            </div>
          </div>
        )}

        {callers.length === 0 && callees.length === 0 && imports.length === 0 && (
          <p className="text-xs text-secondary/60">No relationships found</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-1.5">
        <button
          onClick={() => goToCode(node.file_path, node.line_start)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary bg-bg border border-border rounded-lg hover:bg-border/50 transition-colors"
        >
          <Code2 size={13} className="text-secondary" />
          View Source Code
        </button>
        <button
          onClick={() => goToDoc(node.qualified_name)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary bg-bg border border-border rounded-lg hover:bg-border/50 transition-colors"
        >
          <FileText size={13} className="text-secondary" />
          View Documentation
        </button>
        <button
          onClick={() => {
            setScopeQN(node.qualified_name);
            setViewType('dependency');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary bg-bg border border-border rounded-lg hover:bg-border/50 transition-colors"
        >
          <Zap size={13} className="text-secondary" />
          Impact Analysis
        </button>
      </div>
    </div>
  );
}
