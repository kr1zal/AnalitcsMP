import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '../services/api';

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
