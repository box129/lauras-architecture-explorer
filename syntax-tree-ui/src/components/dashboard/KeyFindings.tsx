import { Lightbulb } from 'lucide-react';

interface KeyFindingsProps {
  findings: string[];
}

export default function KeyFindings({ findings }: KeyFindingsProps) {
  if (findings.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Lightbulb size={14} className="text-warning" />
        <span className="text-sm text-primary font-medium">Key Findings</span>
      </div>
      <div className="space-y-2">
        {findings.map((finding, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-primary/80 leading-relaxed">{finding}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
