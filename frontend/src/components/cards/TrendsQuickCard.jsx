export default function TrendsQuickCard() {
  const items = [
    { label: 'KC últimos 5', value: 'PPG 28.4, EPA/play +0.12' },
    { label: 'BUF últimos 5', value: 'PPG 26.1, EPA/play +0.08' },
    { label: 'BAL home', value: 'EPA/play +0.10, RedZone TD% 62%' }
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
      <div className="text-sm font-semibold text-zinc-900 mb-3">Tendencias rápidas</div>
      <div className="space-y-2 text-sm">
        {items.map((t, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl border border-zinc-200 text-zinc-800">
            <span>{t.label}</span>
            <span className="text-zinc-500">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


