import { useSyntaxTreeStore } from '../../store';

interface Citation {
  entity_qn?: string;
  entity_name?: string;
  file_path?: string;
  line_start?: number;
  [key: string]: unknown;
}

interface CitationChipsProps {
  citations: Citation[];
}

export default function CitationChips({ citations }: CitationChipsProps) {
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);

  if (citations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {citations.map((c, i) => {
        const label = c.entity_name || c.entity_qn?.split('.').pop() || `Citation ${i + 1}`;
        const location = c.file_path ? `${c.file_path.split('/').pop()}:${c.line_start || '?'}` : '';

        return (
          <button
            key={i}
            onClick={() => {
              if (c.entity_qn) selectNode(c.entity_qn);
              if (c.file_path) goToCode(c.file_path, c.line_start || 1);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-bg border border-border rounded-full hover:border-info/50 hover:text-info transition-colors font-mono"
          >
            <span className="text-primary">{label}</span>
            {location && <span className="text-secondary">{location}</span>}
          </button>
        );
      })}
    </div>
  );
}
