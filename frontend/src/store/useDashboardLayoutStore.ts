/**
 * Zustand store для настроек layout дашборда (Widget Dashboard)
 *
 * Хранит: список включённых виджетов (порядок = порядок отображения),
 * количество колонок, флаги отображения.
 * Персистенция через React Query (GET/PUT /dashboard/config).
 */
import { create } from 'zustand';
import { DEFAULT_ENABLED_WIDGETS } from '../components/Dashboard/widgets/definitions';

interface DashboardLayoutState {
  /** Упорядоченный список ID включённых виджетов */
  enabledWidgets: string[];
  /** Количество колонок в grid (2-6) */
  columnCount: number;
  /** Показывать badge оси данных на карточках */
  showAxisBadges: boolean;
  /** Компактный режим (меньше padding) */
  compactMode: boolean;
  /** Конфиг загружен с сервера */
  isLoaded: boolean;
  /** Есть несохранённые изменения */
  isDirty: boolean;

  // Actions
  setConfig: (config: {
    enabledWidgets: string[];
    columnCount: number;
    showAxisBadges: boolean;
    compactMode: boolean;
  }) => void;
  toggleWidget: (id: string) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  setColumnCount: (n: number) => void;
  toggleAxisBadges: () => void;
  toggleCompactMode: () => void;
  resetToDefaults: () => void;
  markClean: () => void;
}

const defaultState = {
  enabledWidgets: DEFAULT_ENABLED_WIDGETS,
  columnCount: 4,
  showAxisBadges: false,
  compactMode: false,
  isLoaded: false,
  isDirty: false,
};

export const useDashboardLayoutStore = create<DashboardLayoutState>((set) => ({
  ...defaultState,

  setConfig: (config) =>
    set({
      enabledWidgets: config.enabledWidgets,
      columnCount: config.columnCount,
      showAxisBadges: config.showAxisBadges,
      compactMode: config.compactMode,
      isLoaded: true,
      isDirty: false,
    }),

  toggleWidget: (id) =>
    set((state) => {
      const idx = state.enabledWidgets.indexOf(id);
      const next =
        idx >= 0
          ? state.enabledWidgets.filter((wId) => wId !== id)
          : [...state.enabledWidgets, id];
      return { enabledWidgets: next, isDirty: true };
    }),

  reorderWidgets: (fromIndex, toIndex) =>
    set((state) => {
      const next = [...state.enabledWidgets];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { enabledWidgets: next, isDirty: true };
    }),

  setColumnCount: (n) =>
    set({ columnCount: n, isDirty: true }),

  toggleAxisBadges: () =>
    set((state) => ({ showAxisBadges: !state.showAxisBadges, isDirty: true })),

  toggleCompactMode: () =>
    set((state) => ({ compactMode: !state.compactMode, isDirty: true })),

  resetToDefaults: () =>
    set({
      enabledWidgets: DEFAULT_ENABLED_WIDGETS,
      columnCount: 4,
      showAxisBadges: false,
      compactMode: false,
      isDirty: true,
    }),

  markClean: () =>
    set({ isDirty: false }),
}));
