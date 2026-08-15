import { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Folder, Loader2, X } from 'lucide-react';
import { fetchApi } from '../../api/client';

interface BrowseDirectoryEntry {
  name: string;
  path: string;
}

interface BrowseDirectoriesResponse {
  path: string | null;
  parent: string | null;
  directories: BrowseDirectoryEntry[];
}

interface FolderBrowserDialogProps {
  onCancel: () => void;
  onSelect: (path: string) => void;
}

/**
 * Participant 1 formative usability finding: "I would love it if i didn't
 * only have to copy the file path... you could make the application open
 * file exploerer and i could easily navigate to the folder I want from
 * there."
 *
 * A real OS-native folder dialog can't hand back an absolute filesystem
 * path to a browser-hosted app (the File System Access API deliberately
 * withholds it), so this is the smallest equivalent: a modal directory
 * browser backed by a read-only, directories-only backend endpoint
 * (`GET /api/fs/browse-directories`). Cancelling does nothing -- the
 * repository path input is only ever changed on explicit "Use this
 * folder." Manual path entry is untouched and remains available.
 */
export default function FolderBrowserDialog({ onCancel, onSelect }: FolderBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [directories, setDirectories] = useState<BrowseDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load(currentPath);
  }, [currentPath]);

  const load = async (path: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : '';
      const response = await fetchApi<BrowseDirectoriesResponse>(`/fs/browse-directories${query}`);
      setDirectories(response.directories);
      setParent(response.parent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list this folder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="obs-folder-browser__overlay" role="dialog" aria-modal="true" aria-label="Browse for a repository folder">
      <div className="obs-folder-browser">
        <header className="obs-folder-browser__header">
          <h2>Browse for a repository folder</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="obs-folder-browser__path" title={currentPath ?? undefined}>
          {currentPath ?? 'Choose a starting location'}
        </div>

        <div className="obs-folder-browser__list" aria-label="Subfolders">
          {loading ? (
            <div className="obs-folder-browser__state">
              <Loader2 size={16} className="observatory-spin" /> Loading folders...
            </div>
          ) : error ? (
            <div className="obs-folder-browser__state obs-folder-browser__state--error">
              <AlertCircle size={16} /> {error}
            </div>
          ) : (
            <>
              {parent !== null && (
                <button type="button" className="obs-folder-browser__item" onClick={() => setCurrentPath(parent)}>
                  <ChevronRight size={14} className="obs-folder-browser__up-icon" /> ..
                </button>
              )}
              {directories.length === 0 && parent === null ? (
                <div className="obs-folder-browser__state">No subfolders here.</div>
              ) : (
                directories.map((entry) => (
                  <button
                    type="button"
                    key={entry.path}
                    className="obs-folder-browser__item"
                    onClick={() => setCurrentPath(entry.path)}
                  >
                    <Folder size={14} /> {entry.name}
                  </button>
                ))
              )}
            </>
          )}
        </div>

        <footer className="obs-folder-browser__footer">
          <button type="button" className="obs-folder-browser__cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="obs-folder-browser__confirm"
            disabled={!currentPath}
            onClick={() => currentPath && onSelect(currentPath)}
          >
            Use this folder
          </button>
        </footer>
      </div>
    </div>
  );
}
