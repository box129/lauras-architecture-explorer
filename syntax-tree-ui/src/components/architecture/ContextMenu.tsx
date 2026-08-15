import { useEffect, useRef } from 'react';
import { Code2, FileText, Zap, GitFork, ArrowRightLeft } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import { useNode } from '../../api/hooks';

export default function ContextMenu() {
  const contextMenu = useSyntaxTreeStore((s) => s.contextMenu);
  const setContextMenu = useSyntaxTreeStore((s) => s.setContextMenu);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const goToDoc = useSyntaxTreeStore((s) => s.goToDoc);
  const setViewType = useSyntaxTreeStore((s) => s.setViewType);
  const setScopeQN = useSyntaxTreeStore((s) => s.setScopeQN);
  const ref = useRef<HTMLDivElement>(null);

  const { data: node } = useNode(contextMenu?.qn ?? null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if ('key' in e && e.key === 'Escape') {
        setContextMenu(null);
        return;
      }
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [setContextMenu]);

  if (!contextMenu) return null;

  const items = [
    {
      icon: Code2,
      label: 'View in Code',
      action: () => {
        if (node?.file_path) goToCode(node.file_path, node.line_start);
      },
    },
    {
      icon: FileText,
      label: 'View Documentation',
      action: () => goToDoc(contextMenu.qn),
    },
    {
      icon: Zap,
      label: 'Impact Analysis',
      action: () => {
        setScopeQN(contextMenu.qn);
        setViewType('dependency');
      },
    },
    {
      icon: GitFork,
      label: 'Show Dependencies',
      action: () => {
        setScopeQN(contextMenu.qn);
        setViewType('dependency');
      },
    },
    {
      icon: ArrowRightLeft,
      label: 'Show Call Flow',
      action: () => {
        setScopeQN(contextMenu.qn);
        setViewType('call-flow');
      },
      show: node?.type === 'function' || node?.type === 'method',
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {items
        .filter((item) => item.show !== false)
        .map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-primary hover:bg-bg transition-colors"
            onClick={() => {
              item.action();
              setContextMenu(null);
            }}
          >
            <item.icon size={13} className="text-secondary" />
            {item.label}
          </button>
        ))}
    </div>
  );
}
