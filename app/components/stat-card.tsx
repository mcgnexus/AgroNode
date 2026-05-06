interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

export default function StatCard({ label, value, unit, icon, color, subtitle }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
          {value}
          <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>
        </p>
        {subtitle && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
