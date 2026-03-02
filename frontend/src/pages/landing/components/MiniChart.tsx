/**
 * CSS-only decorative mini bar chart for the Dashboard hero card.
 * No Recharts, no Framer Motion — pure Tailwind.
 */

const BARS = [
  { label: 'Выручка', width: 'w-[85%]', gradient: 'from-indigo-500 to-violet-500' },
  { label: 'Прибыль', width: 'w-[62%]', gradient: 'from-emerald-500 to-green-500' },
  { label: 'Расходы', width: 'w-[38%]', gradient: 'from-purple-500 to-violet-500' },
] as const;

export function MiniChart() {
  return (
    <div className="mt-4 space-y-2">
      {BARS.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 shrink-0">{bar.label}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${bar.width} bg-gradient-to-r ${bar.gradient} rounded-full`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
