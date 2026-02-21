/**
 * WidgetSettingsPanel — панель настроек виджетов дашборда
 *
 * Lazy-loaded из WidgetGrid. Будет содержать:
 * - Toggle для каждого виджета (по категориям)
 * - Настройки колонок, AxisBadge, компактного режима
 * - Сброс к дефолтам
 *
 * TODO: полная реализация в следующей задаче
 */
import { X } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore';
import { WIDGETS_BY_CATEGORY } from './widgets/definitions';
import { WIDGET_CATEGORIES, type WidgetCategory } from './widgets/registry';

interface WidgetSettingsPanelProps {
  onClose: () => void;
}

const CATEGORY_ORDER: WidgetCategory[] = ['sales', 'finance', 'ads', 'stocks', 'plan', 'delta'];

const WidgetSettingsPanel = ({ onClose }: WidgetSettingsPanelProps) => {
  const enabledWidgets = useDashboardLayoutStore((s) => s.enabledWidgets);
  const toggleWidget = useDashboardLayoutStore((s) => s.toggleWidget);
  const columnCount = useDashboardLayoutStore((s) => s.columnCount);
  const setColumnCount = useDashboardLayoutStore((s) => s.setColumnCount);
  const showAxisBadges = useDashboardLayoutStore((s) => s.showAxisBadges);
  const toggleAxisBadges = useDashboardLayoutStore((s) => s.toggleAxisBadges);
  const compactMode = useDashboardLayoutStore((s) => s.compactMode);
  const toggleCompactMode = useDashboardLayoutStore((s) => s.toggleCompactMode);
  const resetToDefaults = useDashboardLayoutStore((s) => s.resetToDefaults);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[61] w-full sm:w-96',
          'bg-white shadow-2xl border-l border-gray-100',
          'flex flex-col overflow-hidden',
          'animate-in slide-in-from-right duration-200',
        )}
        role="dialog"
        aria-label="Настройки виджетов"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Настройки виджетов</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Grid settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Отображение</h3>

            {/* Column count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Колонки</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setColumnCount(n)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      columnCount === n
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Axis badges toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Оси данных</span>
              <button
                role="switch"
                aria-checked={showAxisBadges}
                onClick={toggleAxisBadges}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  showAxisBadges ? 'bg-indigo-600' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    showAxisBadges && 'translate-x-4',
                  )}
                />
              </button>
            </label>

            {/* Compact mode toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Компактный режим</span>
              <button
                role="switch"
                aria-checked={compactMode}
                onClick={toggleCompactMode}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  compactMode ? 'bg-indigo-600' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    compactMode && 'translate-x-4',
                  )}
                />
              </button>
            </label>
          </div>

          {/* Widget toggles by category */}
          {CATEGORY_ORDER.map((category) => {
            const meta = WIDGET_CATEGORIES[category];
            const widgets = WIDGETS_BY_CATEGORY[category];
            if (!widgets?.length) return null;

            return (
              <div key={category} className="space-y-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {meta.label}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{meta.description}</p>
                </div>

                <div className="space-y-1">
                  {widgets.map((w) => {
                    const isEnabled = enabledWidgets.includes(w.id);
                    const IconComponent = w.icon;

                    return (
                      <button
                        key={w.id}
                        onClick={() => toggleWidget(w.id)}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors',
                          isEnabled
                            ? 'bg-indigo-50 text-gray-900'
                            : 'bg-white text-gray-500 hover:bg-gray-50',
                        )}
                      >
                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1 truncate">{w.title}</span>
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                            isEnabled
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-gray-300',
                          )}
                        >
                          {isEnabled && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={resetToDefaults}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Сбросить к настройкам по умолчанию
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default WidgetSettingsPanel;
