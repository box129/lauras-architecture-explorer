import { useState } from 'react';
import { useSyntaxTreeStore } from '../../store';
import { getSourceRegion } from './api';
import type { EvidenceItemDTO, SourceRegionDTO } from './apiTypes';

interface EvidenceItemRowProps {
  item: EvidenceItemDTO;
}

const NO_SOURCE_COPY = 'No source region recorded for this evidence item -- navigation is unavailable.';

/**
 * Renders one evidence-chain item and, when it carries a `source_region_id`,
 * a real "Open source" action that navigates straight to the exact
 * file/line the relation was observed at.
 *
 * Reuses existing infrastructure end to end -- no second source-location
 * model:
 *   - the backend's registered `GET /api/source-regions/{id}` route
 *     (api/routes/source.py) for resolving the id to path/start_line/
 *     end_line/text -- see `getSourceRegion` in `./api.ts`.
 *   - the store's existing `goToCode(filePath, line)` action (`src/store.ts`),
 *     the same "jump to source" mechanism the legacy NodeInspector's
 *     "View Source Code" button already uses, which switches the main
 *     surface to the code viewer and hands Monaco a `targetLine` to
 *     scroll to/highlight (`CodeViewer.tsx`).
 *
 * When `item.source_region_id` is absent, the button is rendered disabled
 * with honest copy explaining why -- never a broken/silently-no-op button.
 */
export default function EvidenceItemRow({ item }: EvidenceItemRowProps) {
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const [region, setRegion] = useState<SourceRegionDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const resolveRegion = async (): Promise<SourceRegionDTO | null> => {
    if (region) return region;
    if (!item.source_region_id) return null;
    setLoading(true);
    setError(null);
    try {
      const resolved = await getSourceRegion(item.source_region_id);
      setRegion(resolved);
      return resolved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve source location.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSource = async () => {
    const resolved = await resolveRegion();
    if (resolved) {
      goToCode(resolved.path, resolved.start_line, resolved.end_line);
      setPreviewOpen(true);
    }
  };

  // Human-readable content leads; raw ids/producer metadata are real
  // provenance data (never destroyed -- see `TechnicalDetails` below) but
  // are not what a first-time reader needs to see first. Addresses Claude
  // Design UX audit finding F03: the evidence chain previously led with
  // truncated raw hex symbol ids and an extractor tool/version string,
  // which reads as internal pipeline metadata rather than legible
  // evidence.
  const relationLabel = (item.relationship_kind || item.kind).replaceAll('_', ' ');

  return (
    <li className="obs-evidence-list__item la-evidence-item">
      <div>
        <strong className="la-evidence-item__relation">{relationLabel}</strong>
        <div className="la-evidence-item__source">
          <button
            type="button"
            disabled={!item.source_region_id || loading}
            title={item.source_region_id ? undefined : NO_SOURCE_COPY}
            aria-disabled={!item.source_region_id}
            onClick={() => void handleOpenSource()}
          >
            {loading ? 'Opening source...' : 'Open source'}
          </button>
          {!item.source_region_id && (
            <p className="la-evidence-item__source-status">{NO_SOURCE_COPY}</p>
          )}
          {error && <p className="la-evidence-item__source-status la-evidence-item__source-status--error">{error}</p>}
          {previewOpen && region && (
            <div className="la-evidence-item__source-body">
              <p className="la-evidence-item__source-path">
                {region.path}:{region.start_line}-{region.end_line}
              </p>
              <pre className="obs-code-static-preview">{region.text}</pre>
            </div>
          )}
        </div>
        <TechnicalDetails item={item} />
      </div>
    </li>
  );
}

/**
 * Raw symbol ids, the backend's freeform provenance sentence, and the
 * producer tool/version stay available -- nothing is destroyed -- but
 * collapsed by default behind a disclosure, so they no longer dominate the
 * ordinary reading path (Claude Design UX audit finding F03).
 */
function TechnicalDetails({ item }: { item: EvidenceItemDTO }) {
  return (
    <details className="la-evidence-item__technical">
      <summary>Technical details</summary>
      <dl>
        <dt>Description</dt>
        <dd>{item.description}</dd>
        <dt>From symbol</dt>
        <dd className="la-evidence-item__technical-id">{item.from_symbol_id || 'unknown symbol'}</dd>
        <dt>To symbol</dt>
        <dd className="la-evidence-item__technical-id">{item.to_symbol_id || 'unknown symbol'}</dd>
        <dt>Recorded by</dt>
        <dd>{item.producer.name}@{item.producer.version}</dd>
        <dt>Evidence id</dt>
        <dd className="la-evidence-item__technical-id">{item.id}</dd>
      </dl>
    </details>
  );
}
