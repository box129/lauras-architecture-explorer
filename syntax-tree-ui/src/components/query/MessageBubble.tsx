import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { QueryResponse } from '../../api/types';
import CitationChips from './CitationChips';
import FollowUpButtons from './FollowUpButtons';
import ConfidenceBar from './ConfidenceBar';
import { useSyntaxTreeStore } from '../../store';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  response?: QueryResponse;
  streaming?: boolean;
  onFollowUp?: (question: string) => void;
}

export default function MessageBubble({ role, text, response, streaming, onFollowUp }: MessageBubbleProps) {
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const startImpactRipple = useSyntaxTreeStore((s) => s.startImpactRipple);

  const isUser = role === 'user';

  const markdownComponents = {
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <pre className="bg-bg border border-border rounded p-2 overflow-x-auto my-1.5">
            <code className={`text-[11px] font-mono ${className || ''}`} {...props}>{children}</code>
          </pre>
        );
      }
      return <code className="bg-bg px-1 py-0.5 rounded text-[11px] font-mono text-accent" {...props}>{children}</code>;
    },
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      if (href && href.startsWith('entity:')) {
        const parts = href.replace('entity:', '').split(':');
        return (
          <button
            className="text-info hover:underline font-mono text-[11px]"
            onClick={() => goToCode(parts[0], parseInt(parts[1]) || 1)}
          >
            {children}
          </button>
        );
      }
      return <a href={href} {...props} className="text-info hover:underline">{children}</a>;
    },
  };

  return (
    <div className={clsx('mb-4', isUser ? 'flex justify-end' : 'flex justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-xl px-4 py-3',
          isUser
            ? 'bg-accent/15 border border-accent/20 text-primary'
            : 'bg-surface border border-border text-primary',
        )}
      >
        <div className="prose prose-invert prose-sm max-w-none text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {text}
          </ReactMarkdown>
        </div>

        {streaming && !text && (
          <div className="flex gap-1 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* After streaming completes, show metadata */}
        {!isUser && response && !streaming && (
          <>
            {response.intent && (
              <div className="mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-interp/20 text-interp">
                  {response.intent}
                </span>
              </div>
            )}

            <CitationChips citations={response.citations} />
            <ConfidenceBar confidence={response.confidence} />

            {response.intent === 'impact' && response.citations.length > 0 && (
              <button
                onClick={() => {
                  const nodes = response.citations
                    .filter((c) => c.entity_qn)
                    .map((c, i) => ({ qn: c.entity_qn!, depth: i }));
                  if (nodes.length > 0) {
                    startImpactRipple(nodes[0].qn, nodes);
                  }
                }}
                className="mt-2 px-2.5 py-1 text-[10px] text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors"
              >
                Show on Architecture
              </button>
            )}

            {onFollowUp && (
              <FollowUpButtons suggestions={response.follow_ups} onSelect={onFollowUp} />
            )}

            {response.run_metadata && <RunDetails meta={response.run_metadata} />}
          </>
        )}
      </div>
    </div>
  );
}

function RunDetails({ meta }: { meta: NonNullable<QueryResponse['run_metadata']> }) {
  const filesCount = meta.files_inspected?.length ?? 0;
  const symbolsCount = meta.symbols_inspected?.length ?? 0;
  const evidenceCount = meta.evidence_sources?.length ?? 0;
  const gaps = meta.unresolved_gaps ?? [];
  const tokensTotal = meta.tokens_in + meta.tokens_out;

  return (
    <details className="mt-3 text-[10px] text-secondary border-t border-border/50 pt-2">
      <summary className="cursor-pointer hover:text-primary select-none flex items-center gap-2">
        <span>Run details</span>
        {meta.fallback_used && (
          <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning flex items-center gap-1">
            <AlertTriangle size={9} /> fallback
          </span>
        )}
        <span className="text-secondary/60">
          · {tokensTotal.toLocaleString()} tok · {filesCount}f · {symbolsCount}s
        </span>
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-secondary/70">Model</div>
        <div className="font-mono text-primary/80 truncate">{meta.model || '—'}</div>
        <div className="text-secondary/70">Tokens (in / out)</div>
        <div className="font-mono text-primary/80">
          {meta.tokens_in.toLocaleString()} / {meta.tokens_out.toLocaleString()}
        </div>
        <div className="text-secondary/70">LLM calls</div>
        <div className="text-primary/80">{meta.llm_call_count}</div>
        <div className="text-secondary/70">Files inspected</div>
        <div className="text-primary/80">{filesCount}</div>
        <div className="text-secondary/70">Symbols inspected</div>
        <div className="text-primary/80">{symbolsCount}</div>
        <div className="text-secondary/70">Evidence sources</div>
        <div className="text-primary/80">{evidenceCount}</div>
      </div>
      {gaps.length > 0 && (
        <div className="mt-2">
          <div className="text-secondary/70 mb-1">Gaps</div>
          <ul className="space-y-0.5">
            {gaps.map((g, i) => (
              <li key={i} className="text-warning/80 flex gap-1.5">
                <span className="shrink-0">·</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
