/**
 * React Query hooks для dashboard данных
 */
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, productsApi } from '../services/api';
import type { DashboardFilters, Marketplace } from '../types';

type QueryOpts = {
  enabled?: boolean;
};

/**
 * Hook для получения сводки по продажам
 */
export const useDashboardSummary = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: () => dashboardApi.getSummary(filters),
    staleTime: 1000 * 60 * 5, // 5 минут
    refetchInterval: 1000 * 60 * 5, // автообновление каждые 5 минут
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения сводки с данными предыдущего периода.
 * Экономит 3-4 HTTP запроса при marketplace=all.
 */
export const useDashboardSummaryWithPrev = (
  filters?: DashboardFilters & { include_ozon_truth?: boolean },
  opts?: QueryOpts
) => {
  return useQuery({
    queryKey: ['dashboard', 'summary-with-prev', filters],
    queryFn: () => dashboardApi.getSummaryWithPrev(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения unit-экономики
 */
export const useUnitEconomics = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'unit-economics', filters],
    queryFn: () => dashboardApi.getUnitEconomics(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения данных графика продаж
 */
export const useSalesChart = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'sales-chart', filters],
    queryFn: () => dashboardApi.getSalesChart(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения остатков на складах
 */
export const useStocks = (marketplace?: Marketplace, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'stocks', marketplace],
    queryFn: () => dashboardApi.getStocks(marketplace === 'all' ? undefined : marketplace),
    staleTime: 1000 * 60 * 10, // 10 минут (остатки меняются реже)
    refetchInterval: 1000 * 60 * 10, // автообновление каждые 10 минут
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения рекламных расходов и ДРР
 */
export const useAdCosts = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'ad-costs', filters],
    queryFn: () => dashboardApi.getAdCosts(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения дерева удержаний (tree-view)
 */
export const useCostsTree = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'costs-tree', filters],
    queryFn: () => dashboardApi.getCostsTree(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения объединённого дерева удержаний (Ozon + WB).
 * Экономит 1 HTTP запрос при marketplace=all.
 */
export const useCostsTreeCombined = (
  filters?: Omit<DashboardFilters, 'marketplace'>,
  opts?: QueryOpts
) => {
  return useQuery({
    queryKey: ['dashboard', 'costs-tree-combined', filters],
    queryFn: () => dashboardApi.getCostsTreeCombined(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

/**
 * Hook для получения списка товаров
 */
export const useProducts = (marketplace?: Marketplace, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['products', marketplace],
    queryFn: () => productsApi.getAll(marketplace === 'all' ? undefined : marketplace),
    staleTime: 1000 * 60 * 30, // 30 минут (товары меняются редко)
    enabled: opts?.enabled ?? true,
  });
};
