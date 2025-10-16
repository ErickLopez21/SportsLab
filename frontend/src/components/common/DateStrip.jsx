import { useMemo } from 'react';

export default function DateStrip({ value, onChange, days = 7 }) {
  const items = useMemo(() => {
    const base = value ? new Date(value) : new Date();
    const center = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const arr = [];
    for (let i = -days; i <= days; i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [value, days]);

  const fmt = (d) => d.toISOString().slice(0, 10);
  const isSelected = (d) => fmt(d) === value;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      {items.map((d) => (
        <button
          key={d.toISOString()}
          onClick={() => onChange?.(fmt(d))}
          className={`px-3 py-1.5 rounded-full text-sm border ${isSelected(d) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
        >
          {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </button>
      ))}
    </div>
  );
}


