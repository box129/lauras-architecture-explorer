import { gradeFromScore } from '../../utils/colors';

interface ScoreCardProps {
  dimensions: { name: string; score: number }[];
}

export default function ScoreCard({ dimensions }: ScoreCardProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {dimensions.map((dim) => {
        const { letter, color } = gradeFromScore(dim.score);
        return (
          <div key={dim.name} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-secondary">{dim.name}</span>
              <span className="text-lg font-bold" style={{ color }}>{letter}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${dim.score}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-right mt-1">
              <span className="text-[10px] text-secondary">{Math.round(dim.score)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
