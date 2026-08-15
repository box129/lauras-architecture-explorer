import { Send, Sparkles } from 'lucide-react';

interface QuestionDockProps {
  suggestions: string[];
  contextLabel: string;
  draftPrompt?: string;
  onDraftChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  loading?: boolean;
}

export default function QuestionDock({
  suggestions,
  contextLabel,
  draftPrompt = '',
  onDraftChange,
  onSubmit,
  loading = false,
}: QuestionDockProps) {
  const submit = () => {
    if (!loading && draftPrompt.trim()) onSubmit?.(draftPrompt);
  };
  return (
    <form
      className={loading ? 'obs-question-dock obs-question-dock--loading' : 'obs-question-dock'}
      aria-label="Ask architecture question"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Sparkles size={20} strokeWidth={1.6} />
      <textarea
        aria-label="Architecture question"
        className="obs-question-dock__input"
        onChange={(event) => onDraftChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={`Ask anything about ${contextLabel}...`}
        rows={1}
        value={draftPrompt}
      />
      <div className="obs-question-dock__suggestions">
        {suggestions.slice(0, 2).map((suggestion) => (
          <button key={suggestion} onClick={() => onDraftChange?.(suggestion)} type="button">{suggestion}</button>
        ))}
      </div>
      <kbd>Ctrl J</kbd>
      <button className="obs-question-dock__send" type="submit" aria-label="Submit question" disabled={loading}>
        <Send size={18} strokeWidth={1.8} />
      </button>
      {loading && <span className="obs-question-dock__loading">Building a source-backed lens...</span>}
    </form>
  );
}
