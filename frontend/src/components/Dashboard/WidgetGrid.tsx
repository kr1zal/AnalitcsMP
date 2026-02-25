/**
 * WidgetGrid — основной grid виджетов дашборда с drag-and-drop
 *
 * Реализует:
 * - DnD-сортировку карточек метрик через @dnd-kit
 * - Динамическое количество колонок (1-5)
 * - Кнопку настроек (gear) для открытия WidgetSettingsPanel
 * - DragOverlay для плавного перетаскивания
 * - Пустое состояние при отсутствии активных виджетов
 * - KeyboardSensor для accessibility
 *
 * Props: widgetValues + loadingStates передаются из DashboardPage.
 */
import { useState, useCallback, lazy, Suspense, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore';
import { SortableWidget, DragOverlayWidget } from './SortableWidget';
import { WidgetEmptyState } from './WidgetEmptyState';
import type { WidgetValue } from './widgets/registry';

// Lazy-load settings panel
const WidgetSettingsPanel = lazy(
  () => import('./WidgetSettingsPanel'),
);

// ── Grid class mapping by column count ──
const GRID_CLASSES: Record<number, string> = {
  1: 'grid grid-cols-1 gap-2',
  2: 'grid grid-cols-2 gap-2 sm:gap-2.5',
  3: 'grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3',
  4: 'grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3',
  5: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5',
};

// Compact: tighter gaps
const GRID_CLASSES_COMPACT: Record<number, string> = {
  1: 'grid grid-cols-1 gap-1.5',
  2: 'grid grid-cols-2 gap-1.5 sm:gap-2',
  3: 'grid grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2 lg:gap-2.5',
  4: 'grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2',
  5: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2',
};

interface WidgetGridProps {
  /** Resolved values for each widget by ID */
  widgetValues: Record<string, WidgetValue>;
  /** Loading state per widget ID */
  loadingStates: Record<string, boolean>;
  /** Whether settings panel is open (controlled from parent) */
  settingsOpen?: boolean;
  /** Callback to open settings panel */
  onOpenSettings?: () => void;
  /** Callback to close settings panel */
  onCloseSettings?: () => void;
}

export const WidgetGrid = ({
  widgetValues,
  loadingStates,
  settingsOpen = false,
  onOpenSettings,
  onCloseSettings,
}: WidgetGridProps) => {
  // ── Store ──
  const enabledWidgets = useDashboardLayoutStore((s) => s.enabledWidgets);
  const columnCount = useDashboardLayoutStore((s) => s.columnCount);
  const showAxisBadges = useDashboardLayoutStore((s) => s.showAxisBadges);
  const compactMode = useDashboardLayoutStore((s) => s.compactMode);
  const locked = useDashboardLayoutStore((s) => s.locked);
  const reorderWidgets = useDashboardLayoutStore((s) => s.reorderWidgets);

  // ── Local state ──
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── DnD sensors (constant size — React requires stable useEffect deps) ──
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: locked ? 1e7 : 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: locked ? 1e7 : 200, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // ── DnD handlers ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = enabledWidgets.indexOf(String(active.id));
      const newIndex = enabledWidgets.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      reorderWidgets(oldIndex, newIndex);
    },
    [enabledWidgets, reorderWidgets],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleCloseSettings = useCallback(() => {
    onCloseSettings?.();
  }, [onCloseSettings]);

  // ── Grid class ──
  const gridClass = useMemo(() => {
    const map = compactMode ? GRID_CLASSES_COMPACT : GRID_CLASSES;
    return map[columnCount] ?? map[4];
  }, [columnCount, compactMode]);

  // ── Empty state ──
  if (enabledWidgets.length === 0) {
    return (
      <>
        <WidgetEmptyState onOpenSettings={handleOpenSettings} />
        <Suspense fallback={null}>
          {settingsOpen && (
            <WidgetSettingsPanel onClose={handleCloseSettings} />
          )}
        </Suspense>
      </>
    );
  }

  return (
    <>
      {/* ── Sortable grid ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={enabledWidgets}
          strategy={rectSortingStrategy}
        >
          <div className={gridClass}>
            {enabledWidgets.map((widgetId) => (
              <SortableWidget
                key={widgetId}
                id={widgetId}
                widgetValue={widgetValues[widgetId]}
                loading={loadingStates[widgetId] ?? false}
                showAxisBadge={showAxisBadges}
                compact={compactMode}
                locked={locked}
              />
            ))}
          </div>
        </SortableContext>

        {/* ── Drag overlay (portal-based by default in @dnd-kit) ── */}
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <DragOverlayWidget
              id={activeId}
              widgetValue={widgetValues[activeId]}
              compact={compactMode}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Settings panel (lazy) ── */}
      <Suspense fallback={null}>
        {settingsOpen && (
          <WidgetSettingsPanel onClose={handleCloseSettings} />
        )}
      </Suspense>
    </>
  );
};
