import { formatNumber } from '../../utils/format';

interface StatCard {
  label: string;
  value: number;
}

interface QuickStatsProps {
  stats: StatCard[];
}

export default function QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{formatNumber(stat.value)}</div>
          <div className="text-[10px] text-secondary mt-1 uppercase tracking-wide">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
