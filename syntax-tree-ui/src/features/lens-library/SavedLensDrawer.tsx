import { BookOpen, Copy, FilePlus2, Library, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import type { LensTour, SavedLens } from './types';
import StatusBadge from '../observatory/StatusBadge';

interface SavedLensDrawerProps {
  open: boolean;
  lenses: SavedLens[];
  activeTour: LensTour | null;
  onOpen: () => void;
  onClose: () => void;
  onSaveCurrent: () => void;
  onRestoreLens: (lens: SavedLens) => void;
  onRenameLens: (id: string, title: string) => void;
  onDuplicateLens: (id: string) => void;
  onDeleteLens: (id: string) => void;
  onCreateTour: () => void;
  onAddToTour: (lensId: string) => void;
  onMoveTourLens: (lensId: string, direction: -1 | 1) => void;
  onPlayTour: () => void;
  onOpenDocs: () => void;
}

export default function SavedLensDrawer({
  open,
  lenses,
  activeTour,
  onOpen,
  onClose,
  onSaveCurrent,
  onRestoreLens,
  onRenameLens,
  onDuplicateLens,
  onDeleteLens,
  onCreateTour,
  onAddToTour,
  onMoveTourLens,
  onPlayTour,
  onOpenDocs,
}: SavedLensDrawerProps) {
  const tourLenses = activeTour ? activeTour.lensIds.map((id) => lenses.find((lens) => lens.id === id)).filter(Boolean) as SavedLens[] : [];
  // Lenses & tours is secondary workspace UX, reachable from the primary
  // navigation menu at any time (see ObservatoryTopBar's "Lenses & tours"
  // item). The always-visible left-edge tab below is only a shortcut for
  // when there is actually something saved -- an empty tab in that
  // position read as unfinished primary functionality competing with
  // Architecture, the product's actual primary surface.
  if (!open) {
    if (lenses.length === 0 && !activeTour) return null;
    return (
      <button className="obs-lens-drawer-tab" type="button" onClick={onOpen} aria-label="Open saved lenses and tours">
        <Library size={15} />
        Lenses
      </button>
    );
  }

  return (
    <aside className="obs-lens-drawer" aria-label="Saved lenses">
      <header className="obs-lens-drawer__header">
        <div>
          <span>Saved memory</span>
          <h2>Lenses & tours</h2>
        </div>
        <button className="obs-icon-button" type="button" aria-label="Close saved lenses" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="obs-lens-drawer__actions">
        <button type="button" onClick={onSaveCurrent}><FilePlus2 size={14} /> Save Lens</button>
        <button type="button" onClick={onOpenDocs}><BookOpen size={14} /> Docs Studio</button>
      </div>

      <section className="obs-lens-drawer__section">
        <h3>Saved lenses</h3>
        {lenses.length === 0 ? (
          <div className="obs-lens-empty">
            Save useful views as lenses, then arrange them into a walkthrough or documentation outline.
          </div>
        ) : (
          <div className="obs-lens-list">
            {lenses.map((lens) => (
              <article className="obs-lens-card" key={lens.id}>
                <button className="obs-lens-card__main" type="button" onClick={() => onRestoreLens(lens)}>
                  <span className="obs-lens-card__type">{lens.type}</span>
                  <strong>{lens.title}</strong>
                  <small>{lens.summary}</small>
                  <span className="obs-lens-card__meta">
                    <StatusBadge status={lens.status} /> {lens.evidenceCount} evidence
                  </span>
                </button>
                <div className="obs-lens-card__controls">
                  <button type="button" title="Rename" onClick={() => {
                    const next = window.prompt('Rename lens', lens.title);
                    if (next?.trim()) onRenameLens(lens.id, next.trim());
                  }}><Pencil size={13} /></button>
                  <button type="button" title="Duplicate" onClick={() => onDuplicateLens(lens.id)}><Copy size={13} /></button>
                  <button type="button" title="Add to tour" onClick={() => onAddToTour(lens.id)}><Plus size={13} /></button>
                  <button type="button" title="Delete" onClick={() => onDeleteLens(lens.id)}><Trash2 size={13} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="obs-lens-drawer__section">
        <div className="obs-lens-section-title">
          <h3>Guided tour</h3>
          <button type="button" onClick={onCreateTour}>{activeTour ? 'Reset' : 'Create'}</button>
        </div>
        {!activeTour ? (
          <div className="obs-lens-empty">Create a tour from saved lenses to build a walkthrough.</div>
        ) : (
          <div className="obs-tour-builder">
            <strong>{activeTour.title}</strong>
            <p>{activeTour.description}</p>
            {tourLenses.map((lens, index) => (
              <div className="obs-tour-row" key={lens.id}>
                <span>{index + 1}</span>
                <button type="button" onClick={() => onRestoreLens(lens)}>{lens.title}</button>
                <div>
                  <button type="button" disabled={index === 0} onClick={() => onMoveTourLens(lens.id, -1)}>Up</button>
                  <button type="button" disabled={index === tourLenses.length - 1} onClick={() => onMoveTourLens(lens.id, 1)}>Down</button>
                </div>
              </div>
            ))}
            <button className="obs-tour-play" type="button" disabled={tourLenses.length === 0} onClick={onPlayTour}>
              <Play size={14} /> Play tour
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}
