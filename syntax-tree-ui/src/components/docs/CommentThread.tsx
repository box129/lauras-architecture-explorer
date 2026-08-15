import { useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { fetchApi } from '../../api/client';

interface Comment {
  text: string;
  timestamp: string;
  status: string;
}

interface CommentThreadProps {
  comments: Comment[];
  sectionQN: string;
  onCommentAdded: () => void;
}

export default function CommentThread({ comments, sectionQN, onCommentAdded }: CommentThreadProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi(`/docs/${encodeURIComponent(sectionQN)}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text: text.trim() }),
      });
      setText('');
      onCommentAdded();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center gap-1.5 mb-3">
        <MessageCircle size={13} className="text-secondary" />
        <span className="text-xs text-secondary font-medium">Comments ({comments.length})</span>
      </div>

      {comments.map((c, i) => (
        <div key={i} className="mb-3 bg-bg border border-border rounded-lg p-3">
          <p className="text-xs text-primary leading-relaxed">{c.text}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-secondary">{new Date(c.timestamp).toLocaleString()}</span>
            <span className={`text-[10px] px-1 py-0.5 rounded ${
              c.status === 'addressed' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {c.status}
            </span>
            {c.status === 'pending' && (
              <span className="text-[10px] text-warning/70 italic">awaiting regeneration</span>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Add a comment..."
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-accent/50 placeholder:text-secondary/50"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="px-3 py-2 bg-accent text-white text-xs rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
