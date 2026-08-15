import ReactDiffViewer from 'react-diff-viewer-continued';

interface DocDiffProps {
  userBody: string;
  aiBody: string;
  onKeepMine: () => void;
  onAcceptAI: () => void;
  onClose: () => void;
}

export default function DocDiff({ userBody, aiBody, onKeepMine, onAcceptAI, onClose }: DocDiffProps) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="bg-surface px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-secondary font-medium">Compare Versions</span>
        <div className="flex gap-2">
          <button
            onClick={onKeepMine}
            className="px-2.5 py-1 text-xs bg-success/20 text-success border border-success/30 rounded hover:bg-success/30 transition-colors"
          >
            Keep Mine
          </button>
          <button
            onClick={onAcceptAI}
            className="px-2.5 py-1 text-xs bg-info/20 text-info border border-info/30 rounded hover:bg-info/30 transition-colors"
          >
            Accept AI
          </button>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs text-secondary border border-border rounded hover:text-primary hover:bg-bg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <ReactDiffViewer
          oldValue={userBody}
          newValue={aiBody}
          splitView
          useDarkTheme
          leftTitle="Your Version"
          rightTitle="AI Generated"
          styles={{
            variables: {
              dark: {
                diffViewerBackground: '#0F0F1A',
                addedBackground: '#4CAF5015',
                removedBackground: '#E9456015',
                wordAddedBackground: '#4CAF5030',
                wordRemovedBackground: '#E9456030',
                addedGutterBackground: '#4CAF5010',
                removedGutterBackground: '#E9456010',
                gutterBackground: '#1A1A2E',
                gutterColor: '#888899',
                codeFoldBackground: '#1A1A2E',
                emptyLineBackground: '#0F0F1A',
              },
            },
          }}
        />
      </div>
    </div>
  );
}
