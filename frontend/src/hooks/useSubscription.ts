import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi, paymentApi } from '../services/api';

export const useSubscription = () => {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.getMy,
    staleTime: 1000 * 60 * 10, // 10 min cache
  });
};

export const usePlans = () => {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: subscriptionApi.getPlans,
    staleTime: 1000 * 60 * 60, // 1 hour cache (static data)
  });
};

export const useUpgrade = () => {
  return useMutation({
    mutationFn: (plan: string) => paymentApi.upgrade(plan),
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => paymentApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
};
