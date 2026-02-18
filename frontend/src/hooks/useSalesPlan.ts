import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesPlanApi } from '../services/api';
import type {
  SalesPlanResponse,
  SalesPlanCompletionResponse,
  SalesPlanSummaryResponse,
  PreviousPlanResponse,
  PlanSuggestResponse,
  DashboardFilters,
} from '../types';

/** Fetch per-product sales plans for a given month + marketplace */
export const useSalesPlan = (month: string, marketplace: string) => {
  return useQuery<SalesPlanResponse>({
    queryKey: ['sales-plan', month, marketplace],
    queryFn: () => salesPlanApi.getPlans(month, marketplace),
    staleTime: 1000 * 60 * 5,
  });
};

/** Upsert per-product sales plan (blur-save pattern) */
export const useUpsertSalesPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { month: string; marketplace: string; items: { product_id: string; plan_revenue: number }[] }) =>
      salesPlanApi.upsertPlans(body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-plan', variables.month, variables.marketplace] });
      queryClient.invalidateQueries({ queryKey: ['sales-plan', 'completion'] });
    },
  });
};

/** Fetch summary plans (total / wb / ozon) for a month */
export const useSalesPlanSummary = (month: string) => {
  return useQuery<SalesPlanSummaryResponse>({
    queryKey: ['sales-plan', 'summary', month],
    queryFn: () => salesPlanApi.getSummary(month),
    staleTime: 1000 * 60 * 5,
  });
};

/** Upsert a summary plan (total / wb / ozon) */
export const useUpsertSummaryPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { month: string; level: string; plan_revenue: number }) =>
      salesPlanApi.upsertSummary(body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-plan', 'summary', variables.month] });
      queryClient.invalidateQueries({ queryKey: ['sales-plan', 'completion'] });
    },
  });
};

/** Reset ALL plans for a month (summary + per-product) */
export const useResetSalesPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => salesPlanApi.reset(month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-plan'] });
    },
  });
};

/** Fetch previous month's plans (for copy feature) */
export const usePreviousPlan = (month: string) => {
  return useQuery<PreviousPlanResponse>({
    queryKey: ['sales-plan', 'previous', month],
    queryFn: () => salesPlanApi.getPrevious(month),
    staleTime: 1000 * 60 * 10,
  });
};

/** Fetch plan suggestions based on last 3 months average */
export const usePlanSuggest = (month: string) => {
  return useQuery<PlanSuggestResponse>({
    queryKey: ['sales-plan', 'suggest', month],
    queryFn: () => salesPlanApi.getSuggest(month),
    staleTime: 1000 * 60 * 10,
  });
};

/** Fetch plan completion for the current dashboard period */
export const useSalesPlanCompletion = (
  filters?: Pick<DashboardFilters, 'date_from' | 'date_to' | 'marketplace'>,
  opts?: { enabled?: boolean }
) => {
  return useQuery<SalesPlanCompletionResponse>({
    queryKey: ['sales-plan', 'completion', filters],
    queryFn: () => salesPlanApi.getCompletion(filters),
    staleTime: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};
