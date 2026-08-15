import { X } from 'lucide-react';
import clsx from 'clsx';
import { useSyntaxTreeStore } from '../../store';

export default function FileTabs() {
  const openFiles = useSyntaxTreeStore((s) => s.openFiles);
  const openFilePath = useSyntaxTreeStore((s) => s.openFilePath);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const closeFile = useSyntaxTreeStore((s) => s.closeFile);

  if (openFiles.length === 0) return null;

  return (
    <div className="h-8 bg-surface border-b border-border flex items-center overflow-x-auto shrink-0">
      {openFiles.map((file) => (
        <div
          key={file.path}
          className={clsx(
            'flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer border-r border-border shrink-0 group',
            file.path === openFilePath
              ? 'bg-bg text-primary border-b-2 border-b-accent'
              : 'text-secondary hover:text-primary hover:bg-bg/50',
          )}
          onClick={() => goToCode(file.path, 1)}
          title={file.path}
        >
          <span className="truncate max-w-[120px]">{file.label}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file.path);
            }}
            className="opacity-0 group-hover:opacity-100 text-secondary hover:text-primary transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
