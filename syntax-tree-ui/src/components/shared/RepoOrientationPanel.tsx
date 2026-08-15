import { AlertCircle, BookOpen, Compass, FileText, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RunOrientationResponse } from '../../api/types';
import { MAP_CONFIDENCE_EXPLANATION, formatMapConfidencePercent } from '../../design/mapConfidence';

interface RepoOrientationPanelProps {
  orientation: RunOrientationResponse | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}

export default function RepoOrientationPanel({
  orientation,
  loading = false,
  error = null,
  compact = false,
}: RepoOrientationPanelProps) {
  const status = orientation?.status ?? 'pending';
  const confidence = formatMapConfidencePercent(orientation?.repo_shape.confidence);
  const frameworks = orientation?.frameworks.slice(0, 5) ?? [];
  const areas = orientation?.areas.slice(0, compact ? 4 : 6) ?? [];
  const reading = orientation?.suggested_reading.slice(0, compact ? 4 : 6) ?? [];
  const unknowns = orientation?.unknowns.slice(0, compact ? 3 : 5) ?? [];
  const warnings = [
    ...(error ? [error] : []),
    ...(orientation?.warnings ?? []),
    ...(status === 'failed' && orientation?.summary ? [orientation.summary] : []),
  ].filter(Boolean);

  return (
    <section className={`repo-orientation ${compact ? 'repo-orientation--compact' : ''}`} aria-label="Repository orientation">
      <div className="repo-orientation__header">
        <div>
          <span className={`repo-orientation__status repo-orientation__status--${status}`}>
            {loading && !orientation ? <Loader2 size={13} className="observatory-spin" /> : <Compass size={13} />}
            {statusLabel(status)}
          </span>
          <h3>{orientation?.repo_shape.label ?? 'Orienting repository'}</h3>
        </div>
        {orientation && (
          <span
            className="repo-orientation__confidence"
            title={MAP_CONFIDENCE_EXPLANATION}
            aria-label={`${confidence}% map confidence. ${MAP_CONFIDENCE_EXPLANATION}`}
          >
            {confidence}% map confidence
          </span>
        )}
      </div>

      <p className="repo-orientation__summary">
        {orientation?.summary || 'Looking for manifests, framework signals, important areas, and starting points before deeper analysis finishes.'}
      </p>

      {frameworks.length > 0 && (
        <div className="repo-orientation__chips" aria-label="Detected framework signals">
          {frameworks.map((framework) => (
            <span key={framework.name}>{framework.name}</span>
          ))}
        </div>
      )}

      <div className="repo-orientation__grid">
        <OrientationList
          icon={<Compass size={14} />}
          title="Important areas"
          empty="No strong areas yet"
          items={areas.map((area) => ({
            key: area.id,
            title: area.name,
            detail: area.description,
            meta: `${formatMapConfidencePercent(area.confidence)}% map confidence — ${area.status}`,
          }))}
        />
        <OrientationList
          icon={<BookOpen size={14} />}
          title="Start reading"
          empty="Suggested files pending"
          items={reading.map((item) => ({
            key: item.path,
            title: item.path,
            detail: item.reason,
            meta: `${formatMapConfidencePercent(item.confidence)}% map confidence`,
          }))}
        />
      </div>

      {(unknowns.length > 0 || warnings.length > 0) && (
        <div className="repo-orientation__unknowns">
          <div className="repo-orientation__section-title">
            <AlertCircle size={14} />
            Still investigating
          </div>
          {unknowns.map((unknown) => (
            <p key={unknown.id}>
              <strong>{unknown.subject}:</strong> {unknown.reason}
            </p>
          ))}
          {warnings.slice(0, 3).map((warning) => (
            <p key={warning}>
              <strong>Warning:</strong> {warning}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function OrientationList({
  icon,
  title,
  empty,
  items,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  items: { key: string; title: string; detail: string; meta: string }[];
}) {
  return (
    <div className="repo-orientation__list">
      <div className="repo-orientation__section-title">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="repo-orientation__empty">{empty}</p>
      ) : items.map((item) => (
        <article key={item.key}>
          <div>
            <FileText size={13} />
            <strong>{item.title}</strong>
          </div>
          <p>{item.detail}</p>
          <span title={MAP_CONFIDENCE_EXPLANATION}>{item.meta}</span>
        </article>
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === 'ready') return 'Orientation ready';
  if (status === 'insufficient') return 'Orientation partial';
  if (status === 'failed') return 'Orientation unavailable';
  return 'Orientation pending';
}
