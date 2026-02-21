/**
 * AxisBadge — pill-badge с источником данных виджета
 *
 * Показывает ось данных (заказы / финансы / реклама / остатки / расчёт / смешанн.)
 * для прозрачности кросс-осевых метрик (Ozon ORDER vs SETTLEMENT).
 */
import { cn } from '../../lib/utils';
import { AXIS_STYLES, type DataAxis } from './widgets/registry';

interface AxisBadgeProps {
  axis: DataAxis;
}

export const AxisBadge = ({ axis }: AxisBadgeProps) => {
  const style = AXIS_STYLES[axis];

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none border',
        style.bg,
        style.text,
        style.border,
      )}
    >
      {style.label}
    </span>
  );
};
