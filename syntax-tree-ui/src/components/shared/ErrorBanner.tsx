import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg text-sm">
      <AlertTriangle size={16} className="text-accent shrink-0" />
      <span className="text-primary flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-2 py-1 bg-surface border border-border rounded hover:bg-border transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
