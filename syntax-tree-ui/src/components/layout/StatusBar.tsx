import { useSyntaxTreeStore } from '../../store';
import { useApiGet } from '../../api/hooks';
import { formatNumber } from '../../utils/format';
import { useTokenStore } from '../../api/tokenStore';
import type { StatsResponse } from '../../api/types';

export default function StatusBar() {
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const selectedQN = useSyntaxTreeStore((s) => s.selectedQN);
  const runMetadata = useSyntaxTreeStore((s) => s.analysisRunMetadata);
  const sessionUsage = useTokenStore((s) => s.sessionUsage);
  const { data: stats } = useApiGet<StatsResponse>(
    analysisStatus === 'completed' ? '/stats' : null
  );

  const hasMetadata = !!runMetadata && analysisStatus === 'completed';
  const tokensTotal = runMetadata ? runMetadata.tokens_in + runMetadata.tokens_out : 0;

  return (
    <footer className="h-6 bg-surface border-t border-border flex items-center px-4 text-[10px] text-secondary gap-4 shrink-0">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            analysisStatus === 'completed'
              ? 'bg-success'
              : analysisStatus === 'running'
              ? 'bg-warning animate-pulse'
              : analysisStatus === 'failed'
              ? 'bg-accent'
              : 'bg-secondary/40'
          }`}
        />
        <span className="capitalize">{analysisStatus}</span>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <span>{formatNumber(stats.total_nodes)} nodes</span>
          <span>{formatNumber(stats.total_edges)} edges</span>
          <span>{Object.keys(stats.nodes_by_language).join(', ')}</span>
        </>
      )}

      {/* AI run metadata */}
      {hasMetadata && (
        <>
          <span className="text-secondary/40">|</span>
          {runMetadata!.model && (
            <span className="font-mono truncate max-w-[180px]" title={runMetadata!.model}>
              {runMetadata!.model}
            </span>
          )}
          <span title={`tokens in / out: ${runMetadata!.tokens_in.toLocaleString()} / ${runMetadata!.tokens_out.toLocaleString()}`}>
            {formatNumber(tokensTotal)} tok
          </span>
          {runMetadata!.fallback_used ? (
            <span className="flex items-center gap-1 text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              fallback
            </span>
          ) : runMetadata!.llm_active ? (
            <span className="flex items-center gap-1 text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              AI
            </span>
          ) : null}
        </>
      )}

      {/* Session token usage */}
      {sessionUsage.totalTokens > 0 && (
        <>
          <span className="text-secondary/40">|</span>
          <span
            title={`Session Prompt: ${sessionUsage.tokensIn.toLocaleString()}\nSession Response: ${sessionUsage.tokensOut.toLocaleString()}`}
            className="text-secondary"
          >
            {formatNumber(sessionUsage.totalTokens)} session tok
          </span>
          <span className="text-emerald-500 font-mono" title="Estimated API cost in USD based on active models">
            ${sessionUsage.estimatedCostUSD.toFixed(5)}
          </span>
        </>
      )}

      <div className="flex-1" />

      {/* Selected node */}
      {selectedQN && (
        <span className="font-mono text-primary/60 truncate max-w-[300px]">{selectedQN}</span>
      )}
    </footer>
  );
}

