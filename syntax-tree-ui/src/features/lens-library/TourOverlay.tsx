import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { LensTour, SavedLens } from './types';
import StatusBadge from '../observatory/StatusBadge';

interface TourOverlayProps {
  tour: LensTour | null;
  lenses: SavedLens[];
  stepIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
}

export default function TourOverlay({ tour, lenses, stepIndex, onPrevious, onNext, onExit }: TourOverlayProps) {
  if (!tour) return null;
  const currentLens = lenses.find((lens) => lens.id === tour.lensIds[stepIndex]) ?? null;
  const total = tour.lensIds.length;
  return (
    <section className="obs-tour-overlay" aria-label="Guided tour playback">
      <div>
        <span>{stepIndex + 1} / {Math.max(total, 1)}</span>
        <strong>{currentLens?.title ?? 'Saved lens is unavailable'}</strong>
        <p>{currentLens?.summary ?? 'This tour step points to a lens that is no longer available. Skip to the next step or exit the tour.'}</p>
        {currentLens && (
          <small>
            <StatusBadge status={currentLens.status} /> {currentLens.type} - {currentLens.evidenceCount} evidence
          </small>
        )}
      </div>
      <div className="obs-tour-overlay__controls">
        <button type="button" disabled={stepIndex <= 0} onClick={onPrevious}><ArrowLeft size={14} /> Previous</button>
        <button type="button" disabled={stepIndex >= total - 1} onClick={onNext}>Next <ArrowRight size={14} /></button>
        <button type="button" onClick={onExit}><X size={14} /> Exit</button>
      </div>
    </section>
  );
}
