import { AlertTriangle, RefreshCw, SearchCode } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}

export function ArchitectureMapSkeleton() {
  return (
    <main className="obs-canvas obs-canvas--state" aria-label="Loading architecture map">
      <div className="obs-skeleton-summary" />
      <div className="obs-skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="obs-skeleton-node" key={index} />
        ))}
      </div>
    </main>
  );
}

export function ArchitectureMapEmptyState({ title, message }: Omit<ErrorStateProps, 'onRetry'>) {
  return (
    <main className="obs-canvas obs-canvas--state" aria-label="No architecture map available">
      <div className="obs-state-card">
        <SearchCode size={28} strokeWidth={1.6} />
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export function ArchitectureMapErrorState({ title, message, onRetry, actionLabel = 'Retry' }: ErrorStateProps) {
  return (
    <main className="obs-canvas obs-canvas--state" aria-label="Architecture map error">
      <div className="obs-state-card obs-state-card--error">
        <AlertTriangle size={28} strokeWidth={1.6} />
        <h1>{title}</h1>
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={15} strokeWidth={1.8} />
            {actionLabel}
          </button>
        )}
      </div>
    </main>
  );
}
