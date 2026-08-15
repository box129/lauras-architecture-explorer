import { useState } from 'react';
import { Send } from 'lucide-react';

interface QueryInputProps {
  onSend: (question: string) => void;
  disabled?: boolean;
}

export default function QueryInput({ onSend, disabled }: QueryInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="flex gap-2 p-3 border-t border-border bg-surface">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Ask about the codebase..."
        disabled={disabled}
        className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-accent/50 placeholder:text-secondary/50 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send size={14} />
      </button>
    </div>
  );
}
