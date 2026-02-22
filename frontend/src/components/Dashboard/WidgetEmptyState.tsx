/**
 * WidgetEmptyState — пустое состояние когда все виджеты отключены
 *
 * Отображает CTA для открытия WidgetSettingsPanel.
 */
import { Plus, Settings2 } from 'lucide-react';

interface WidgetEmptyStateProps {
  onOpenSettings: () => void;
}

export const WidgetEmptyState = ({ onOpenSettings }: WidgetEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 sm:py-16 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
    <button
      onClick={onOpenSettings}
      className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 hover:bg-indigo-100 transition-colors mb-4"
      aria-label="Добавить виджеты"
    >
      <Plus className="w-7 h-7 text-indigo-600" />
    </button>

    <p className="text-sm font-medium text-gray-900 mb-1">
      Нет активных виджетов
    </p>

    <button
      onClick={onOpenSettings}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
    >
      <span>Добавьте метрики через</span>
      <Settings2 className="w-3.5 h-3.5" />
      <span>Настройки</span>
    </button>
  </div>
);
