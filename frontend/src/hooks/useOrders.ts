/**
 * React Query hooks для Монитора заказов (Phase 1 funnel + Phase 2 per-order)
 */
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../services/api';
import type { DashboardFilters, OrdersFilters } from '../types';

type QueryOpts = {
  enabled?: boolean;
};

export const useOrderFunnel = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['orders', 'funnel', filters],
    queryFn: () => ordersApi.getFunnel(filters),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

export const useOrdersList = (filters?: OrdersFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['orders', 'list', filters],
    queryFn: () => ordersApi.getList(filters),
    staleTime: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};

export const useOrderDetail = (orderId: string | null, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => ordersApi.getDetail(orderId!),
    staleTime: 1000 * 60 * 10,
    enabled: (opts?.enabled ?? true) && !!orderId,
  });
};
