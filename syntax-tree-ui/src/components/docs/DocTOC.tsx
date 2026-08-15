import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { DocTreeItem } from '../../api/types';

interface DocTOCProps {
  sections: DocTreeItem[];
  selectedQN: string | null;
  onSelect: (qn: string) => void;
}

function StatusDot({ item }: { item: DocTreeItem }) {
  if (item.has_pending_comments) return <div className="w-1.5 h-1.5 rounded-full bg-info shrink-0" title="Has comments" />;
  if (item.is_stale && item.user_edited) return <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Stale + edited" />;
  if (item.is_stale) return <div className="w-1.5 h-1.5 rounded-full bg-warning/70 shrink-0" title="Stale" />;
  if (item.user_edited) return <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" title="User edited" />;
  return null;
}

function TOCItem({ item, depth, selectedQN, onSelect }: {
  item: DocTreeItem;
  depth: number;
  selectedQN: string | null;
  onSelect: (qn: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedQN === item.qualified_name;

  return (
    <div>
      <button
        className={clsx(
          'w-full flex items-center gap-1.5 py-1.5 text-left text-xs transition-colors hover:bg-bg/60 rounded',
          isSelected ? 'bg-bg text-primary' : 'text-secondary',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(item.qualified_name)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0 text-secondary hover:text-primary"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <div className="w-3 shrink-0" />
        )}
        <span className="truncate flex-1">{item.title}</span>
        <StatusDot item={item} />
      </button>

      {hasChildren && expanded && (
        <div>
          {item.children.map((child: DocTreeItem) => (
            <TOCItem
              key={child.qualified_name}
              item={child}
              depth={depth + 1}
              selectedQN={selectedQN}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocTOC({ sections, selectedQN, onSelect }: DocTOCProps) {
  return (
    <div className="h-full overflow-y-auto py-2">
      <div className="px-3 pb-2 text-[10px] text-secondary uppercase tracking-wide font-semibold">
        Table of Contents
      </div>
      {sections.map((section) => (
        <TOCItem
          key={section.qualified_name}
          item={section}
          depth={0}
          selectedQN={selectedQN}
          onSelect={onSelect}
        />
      ))}
      {sections.length === 0 && (
        <p className="text-xs text-secondary/60 px-3 py-4">No documentation generated yet</p>
      )}
    </div>
  );
}
