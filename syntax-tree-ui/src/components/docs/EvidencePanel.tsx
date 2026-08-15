import { AlertTriangle, CheckCircle2, GitBranch, FileCode2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocSectionResponse, EvidenceLedger } from '../../api/types';

interface EvidencePanelProps {
  section: DocSectionResponse;
}

export default function EvidencePanel({ section }: EvidencePanelProps) {
  const ledger: EvidenceLedger = section.evidence_ledger || {};
  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-surface overflow-y-auto p-3">
      <div className="text-xs text-primary font-medium mb-3">Evidence</div>
      {section.planning_fallback_used && (
        <div className="mb-4 rounded border border-warning/30 bg-warning/10 px-2 py-2 text-[11px] text-warning">
          This artifact was generated from a fallback plan.
        </div>
      )}
      <EvidenceBlock
        title="Planning Errors"
        icon={<AlertTriangle size={13} />}
        items={(section.planning_errors || []).map((item) => String(item))}
        tone="warning"
      />
      <EvidenceBlock
        title="Verified Claims"
        icon={<CheckCircle2 size={13} />}
        items={section.verified_claims || []}
        tone="success"
      />
      <EvidenceBlock
        title="Unsupported Claims"
        icon={<AlertTriangle size={13} />}
        items={section.unsupported_claims || []}
        tone="warning"
      />
      <EvidenceBlock
        title="Architecture"
        icon={<GitBranch size={13} />}
        items={(ledger.architecture_entities || []).map((item) => `${item.type}: ${item.label}`)}
      />
      <EvidenceBlock
        title="Code"
        icon={<FileCode2 size={13} />}
        items={(ledger.code_entities || []).map((item) => item.file_path ? `${item.label} (${item.file_path})` : item.label)}
      />
      <EvidenceBlock
        title="Dependencies"
        items={(ledger.dependencies || []).slice(0, 20).map((edge) => `${edge.source_qn} -> ${edge.target_qn} (${edge.edge_type})`)}
      />
      <EvidenceBlock
        title="Uncertainties"
        items={(ledger.uncertainties || []).map((item) => String(item))}
        tone="warning"
      />
    </aside>
  );
}

function EvidenceBlock({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon?: ReactNode;
  tone?: 'success' | 'warning';
}) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-secondary';
  return (
    <section className="mb-4">
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold mb-2 ${color}`}>
        {icon}
        <span>{title}</span>
      </div>
      {items.length ? (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="text-[11px] text-secondary bg-bg border border-border rounded px-2 py-1 wrap-break-word">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-secondary/60">None recorded</div>
      )}
    </section>
  );
}
