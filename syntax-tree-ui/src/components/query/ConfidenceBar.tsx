import { confidenceColor } from '../../utils/colors';

interface ConfidenceBarProps {
  confidence: number;
}

export default function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const color = confidenceColor(confidence);

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${confidence * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-secondary">{Math.round(confidence * 100)}%</span>
    </div>
  );
}
