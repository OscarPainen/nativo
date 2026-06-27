interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

export default function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
