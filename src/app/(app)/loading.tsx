export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded-lg bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-[var(--radius-card)] bg-slate-200/60" />
        ))}
      </div>
      <div className="h-96 rounded-[var(--radius-card)] bg-slate-200/50" />
    </div>
  );
}
