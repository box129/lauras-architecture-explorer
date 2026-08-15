interface FollowUpButtonsProps {
  suggestions: string[];
  onSelect: (question: string) => void;
}

export default function FollowUpButtons({ suggestions, onSelect }: FollowUpButtonsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="px-2.5 py-1 text-[10px] text-secondary border border-border rounded-full hover:text-primary hover:border-accent/50 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
