import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Edit3, RefreshCw, GitCompareArrows, Loader2, AlertTriangle } from 'lucide-react';
import type { DocSectionResponse } from '../../api/types';
import { fetchApi } from '../../api/client';
import { useSyntaxTreeStore } from '../../store';
import CommentThread from './CommentThread';
import DocDiff from './DocDiff';
import MarkdownEditor from './MarkdownEditor';
import EvidencePanel from './EvidencePanel';

interface DocContentProps {
  section: DocSectionResponse;
  onRefresh: () => void;
}

export default function DocContent({ section, onRefresh }: DocContentProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = async (body: string) => {
    setSaving(true);
    try {
      await fetchApi(`/docs/${encodeURIComponent(section.qualified_name)}/edit`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      });
      setEditing(false);
      onRefresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await fetchApi(`/docs/${encodeURIComponent(section.qualified_name)}/regenerate`, {
        method: 'POST',
      });
      onRefresh();
    } catch (e) {
      setRegenerateError(e instanceof Error ? e.message : 'Regeneration failed');
    }
    finally { setRegenerating(false); }
  };

  // Custom markdown components for code references
  const markdownComponents = {
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      // Check if this is an entity reference
      if (href && href.startsWith('entity:')) {
        const parts = href.replace('entity:', '').split(':');
        const filePath = parts[0];
        const line = parseInt(parts[1]) || 1;
        return (
          <button
            className="text-info hover:underline font-mono text-xs"
            onClick={() => goToCode(filePath, line)}
          >
            {children}
          </button>
        );
      }
      return <a href={href} {...props} className="text-info hover:underline">{children}</a>;
    },
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <pre className="bg-bg border border-border rounded-lg p-3 overflow-x-auto my-2">
            <code className={`text-xs font-mono text-primary ${className || ''}`} {...props}>{children}</code>
          </pre>
        );
      }
      return (
        <code className="bg-bg px-1.5 py-0.5 rounded text-xs font-mono text-accent" {...props}>{children}</code>
      );
    },
  };

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-secondary">
            {section.artifact_type || section.doc_level}
          </span>
          {section.certification_state && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info">
              {section.certification_state}
            </span>
          )}
          {section.is_stale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Stale</span>
          )}
          {section.user_edited && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success">Edited</span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-primary">{section.title}</h2>
        {section.summary && (
          <p className="text-sm text-secondary mt-1">{section.summary}</p>
        )}
        <div className="mt-2 text-[10px] text-secondary font-mono wrap-break-word">
          {section.target_entity_qn}
        </div>

        {/* Stale banner */}
        {section.is_stale && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">This section is stale.</span>{' '}
              {section.stale_reason || 'Underlying code has changed since the artifact was generated. Click Regenerate.'}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 mb-4">
        {!editing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-secondary bg-bg border border-border rounded hover:text-primary hover:bg-border/50 transition-colors"
          >
            <Edit3 size={12} /> Edit
          </button>
        )}
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-secondary bg-bg border border-border rounded hover:text-primary hover:bg-border/50 transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Regenerate
        </button>
        {section.user_edited && (
          <button
            onClick={() => setShowDiff(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-secondary bg-bg border border-border rounded hover:text-primary hover:bg-border/50 transition-colors"
          >
            <GitCompareArrows size={12} /> Compare
          </button>
        )}
      </div>

      {regenerateError && (
        <div className="mb-4 text-xs text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 wrap-break-word">
          {regenerateError}
        </div>
      )}

      {/* Diff view */}
      {showDiff && (
        <div className="mb-4">
          <DocDiff
            userBody={section.body}
            aiBody={section.ai_generated_body || section.body}
            onKeepMine={() => setShowDiff(false)}
            onAcceptAI={async () => {
              const aiBody = section.ai_generated_body;
              if (aiBody) {
                await fetchApi(`/docs/${encodeURIComponent(section.qualified_name)}/edit`, {
                  method: 'PUT',
                  body: JSON.stringify({ body: aiBody }),
                });
                onRefresh();
              }
              setShowDiff(false);
            }}
            onClose={() => setShowDiff(false)}
          />
        </div>
      )}

      {/* Body */}
      {editing ? (
        <div className="mb-4">
          <MarkdownEditor
            markdown={section.body}
            saving={saving}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {section.body || '*No content generated yet.*'}
          </ReactMarkdown>
        </div>
      )}

      {/* Code References */}
      {section.code_references.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <span className="text-xs text-secondary font-medium">Code References</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {section.code_references.map((ref, i) => {
              const lineStart = (ref.line_start as number) || 1;
              const filePath = (ref.file_path as string) || '';
              const label =
                (ref.name as string) || (ref.qualified_name as string) || `ref-${i}`;
              return (
                <button
                  key={i}
                  onClick={() => goToCode(filePath, lineStart)}
                  className="text-[10px] px-2 py-1 bg-bg border border-border rounded font-mono text-info hover:bg-border/50 transition-colors"
                  title={filePath ? `${filePath}:${lineStart}` : undefined}
                >
                  {label}
                  {filePath && <span className="text-secondary/70 ml-1">:{lineStart}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Embedded Diagrams */}
      {section.embedded_diagrams && section.embedded_diagrams.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <span className="text-xs text-secondary font-medium">Embedded Diagrams</span>
          <div className="mt-2 space-y-2">
            {section.embedded_diagrams.map((diag, i) => {
              const d = diag as Record<string, unknown>;
              const title = (d.title as string) || (d.kind as string) || `Diagram ${i + 1}`;
              const source = (d.source as string) || (d.content as string) || (d.body as string) || '';
              const kind = (d.kind as string) || (d.format as string) || '';
              return (
                <details key={i} className="bg-bg border border-border rounded">
                  <summary className="cursor-pointer px-3 py-1.5 text-xs text-primary flex items-center gap-2 hover:bg-border/30">
                    <span>{title}</span>
                    {kind && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-secondary font-mono">
                        {kind}
                      </span>
                    )}
                  </summary>
                  <pre className="px-3 py-2 text-[11px] font-mono text-primary/80 overflow-x-auto border-t border-border">
                    {source || '(no source)'}
                  </pre>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments */}
      <CommentThread
        comments={section.user_comments}
        sectionQN={section.qualified_name}
        onCommentAdded={onRefresh}
      />

      {/* Confidence */}
      <div className="mt-4 pt-4 border-t border-border">
        <span className="text-[10px] text-secondary">
          Confidence: {Math.round(section.confidence * 100)}%
        </span>
      </div>
      </div>
      <EvidencePanel section={section} />
    </div>
  );
}
