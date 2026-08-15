import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  id: string | null;
  label: string;
  title?: string;
}

interface BreadcrumbTrailProps {
  items: BreadcrumbItem[];
  onSelect?: (index: number) => void;
}

export default function BreadcrumbTrail({ items, onSelect }: BreadcrumbTrailProps) {
  return (
    <nav className="obs-breadcrumb" aria-label="Architecture breadcrumb">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <span className="obs-breadcrumb__item" key={`${item.id ?? 'root'}-${item.label}-${index}`}>
            {isCurrent || !onSelect ? (
              <span title={item.title} aria-current={isCurrent ? 'location' : undefined}>{item.label}</span>
            ) : (
              <button type="button" title={item.title} onClick={() => onSelect(index)}>
                {item.label}
              </button>
            )}
            {index < items.length - 1 && <ChevronRight size={13} strokeWidth={1.8} />}
          </span>
        );
      })}
    </nav>
  );
}
