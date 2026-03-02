/**
 * CSS-only decorative mini waterfall for the Profit hero card.
 * Shows revenue → costs → ads = profit breakdown.
 * No Recharts, no Framer Motion — pure Tailwind.
 */

const SEGMENTS = [
  { label: 'Выр.', height: 'h-16', marginTop: 'mt-0', gradient: 'from-indigo-500 to-indigo-400' },
  { label: 'Удерж.', height: 'h-10', marginTop: 'mt-6', gradient: 'from-purple-500 to-purple-400' },
  { label: 'Рекл.', height: 'h-6', marginTop: 'mt-10', gradient: 'from-amber-500 to-amber-400' },
  { label: 'Приб.', height: 'h-12', marginTop: 'mt-4', gradient: 'from-emerald-500 to-emerald-400' },
] as const;

export function MiniWaterfall() {
  return (
    <div className="mt-4 flex items-end gap-1.5 h-20">
      {SEGMENTS.map((seg) => (
        <div key={seg.label} className="flex-1 flex flex-col items-center">
          <div
            className={`w-full bg-gradient-to-t ${seg.gradient} rounded-t ${seg.height} ${seg.marginTop}`}
          />
          <span className="text-[10px] text-gray-500 mt-1">{seg.label}</span>
        </div>
      ))}
    </div>
  );
}
