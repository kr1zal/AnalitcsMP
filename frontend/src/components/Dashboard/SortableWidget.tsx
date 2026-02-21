/**
 * SortableWidget — обёртка SummaryCard с drag-and-drop функциональностью
 *
 * Использует @dnd-kit/sortable для перетаскивания виджетов внутри WidgetGrid.
 * Рендерит drag handle (grip dots) при hover и опциональный AxisBadge.
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { SummaryCard } from './SummaryCard';
import { AxisBadge } from './AxisBadge';
import { WIDGET_MAP } from './widgets/definitions';
import type { WidgetValue } from './widgets/registry';

interface SortableWidgetProps {
  id: string;
  widgetValue: WidgetValue | undefined;
  loading: boolean;
  showAxisBadge: boolean;
  compact: boolean;
}

export const SortableWidget = ({
  id,
  widgetValue,
  loading,
  showAxisBadge,
  compact,
}: SortableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const definition = WIDGET_MAP.get(id);
  if (!definition) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const tooltipText = definition.tooltipLines.join('\n');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group cursor-grab active:cursor-grabbing touch-none h-full',
        compact && '[&>div]:p-3 [&>div]:sm:p-4',
      )}
      {...attributes}
      {...listeners}
      aria-roledescription="sortable widget"
    >
      <SummaryCard
        title={definition.title}
        mobileTitle={definition.mobileTitle}
        value={widgetValue?.value ?? 0}
        format={definition.format}
        secondaryValue={widgetValue?.secondaryValue}
        subtitle={widgetValue?.subtitle}
        tooltip={tooltipText}
        icon={definition.icon}
        accent={widgetValue?.accentOverride ?? definition.accent}
        change={widgetValue?.change}
        isPositive={widgetValue?.isPositive}
        loading={loading}
        warning={widgetValue?.warning}
      />

      {/* Axis badge — под заголовком карточки */}
      {showAxisBadge && !loading && (
        <div className="absolute bottom-2 right-3 sm:bottom-2.5 sm:right-4">
          <AxisBadge axis={definition.axis} />
        </div>
      )}
    </div>
  );
};

/**
 * DragOverlayWidget — рендерит превью виджета при перетаскивании
 *
 * Используется внутри DragOverlay для плавного drag preview.
 * Не интерактивный — только визуальное отображение.
 */
export const DragOverlayWidget = ({
  id,
  widgetValue,
  compact,
}: {
  id: string;
  widgetValue: WidgetValue | undefined;
  compact: boolean;
}) => {
  const definition = WIDGET_MAP.get(id);
  if (!definition) return null;

  const tooltipText = definition.tooltipLines.join('\n');

  return (
    <div
      className={cn(
        'shadow-xl rounded-2xl ring-2 ring-indigo-200',
        compact && '[&>div]:p-3 [&>div]:sm:p-4',
      )}
    >
      <SummaryCard
        title={definition.title}
        mobileTitle={definition.mobileTitle}
        value={widgetValue?.value ?? 0}
        format={definition.format}
        secondaryValue={widgetValue?.secondaryValue}
        subtitle={widgetValue?.subtitle}
        tooltip={tooltipText}
        icon={definition.icon}
        accent={widgetValue?.accentOverride ?? definition.accent}
        change={widgetValue?.change}
        isPositive={widgetValue?.isPositive}
        warning={widgetValue?.warning}
      />
    </div>
  );
};
