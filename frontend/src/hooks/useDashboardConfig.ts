/**
 * React Query hook для загрузки/сохранения конфигурации дашборда (Widget Dashboard)
 *
 * Загружает конфиг с сервера при монтировании, синхронизирует в Zustand store.
 * Debounced auto-save при isDirty (1.5 сек задержка).
 */
import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardConfigApi } from '../services/api';
import { useDashboardLayoutStore } from '../store/useDashboardLayoutStore';
import type { DashboardConfigPayload } from '../types';

const STALE_TIME = 1000 * 60 * 30; // 30 минут
const DEBOUNCE_MS = 1500;

/**
 * Hook для загрузки конфигурации дашборда
 */
export const useDashboardConfigQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'config'],
    queryFn: () => dashboardConfigApi.getConfig(),
    staleTime: STALE_TIME,
  });
};

/**
 * Hook для сохранения конфигурации дашборда
 */
export const useDashboardConfigMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DashboardConfigPayload) => dashboardConfigApi.saveConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'config'] });
    },
  });
};

/**
 * Основной hook: загрузка конфига с сервера -> Zustand store + auto-save при изменениях.
 * Подключается один раз в DashboardPage.
 */
export const useDashboardConfig = () => {
  const { data, isLoading, error } = useDashboardConfigQuery();
  const mutation = useDashboardConfigMutation();

  const setConfig = useDashboardLayoutStore((s) => s.setConfig);
  const markClean = useDashboardLayoutStore((s) => s.markClean);
  const isLoaded = useDashboardLayoutStore((s) => s.isLoaded);
  const isDirty = useDashboardLayoutStore((s) => s.isDirty);
  const enabledWidgets = useDashboardLayoutStore((s) => s.enabledWidgets);
  const columnCount = useDashboardLayoutStore((s) => s.columnCount);
  const showAxisBadges = useDashboardLayoutStore((s) => s.showAxisBadges);
  const compactMode = useDashboardLayoutStore((s) => s.compactMode);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync server config -> Zustand store (once, when loaded)
  useEffect(() => {
    if (data?.config && !isLoaded) {
      setConfig({
        enabledWidgets: data.config.enabled_widgets,
        columnCount: data.config.column_count,
        showAxisBadges: data.config.show_axis_badges,
        compactMode: data.config.compact_mode,
      });
    }
  }, [data, isLoaded, setConfig]);

  // Debounced auto-save when isDirty
  useEffect(() => {
    if (!isDirty || !isLoaded) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const payload: DashboardConfigPayload = {
        enabled_widgets: enabledWidgets,
        column_count: columnCount,
        show_axis_badges: showAxisBadges,
        compact_mode: compactMode,
      };
      mutation.mutate(payload, {
        onSuccess: () => {
          markClean();
        },
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, enabledWidgets, columnCount, showAxisBadges, compactMode, isLoaded]);

  return {
    isLoading,
    error,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
