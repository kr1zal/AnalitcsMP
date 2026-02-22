import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../services/api';
import type { ProductsResponse } from '../types';

/** Fetch all products for the current user */
export const useProducts = () => {
  return useQuery<ProductsResponse>({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });
};

/** Update purchase price (syncs to linked products) */
export const useUpdatePurchasePrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, price }: { productId: string; price: number }) =>
      productsApi.updatePurchasePrice(productId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

/** Bulk reorder products */
export const useReorderProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { product_id: string; sort_order: number }[]) =>
      productsApi.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

/** Link two products across marketplaces */
export const useLinkProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wbId, ozonId, purchasePrice }: { wbId: string; ozonId: string; purchasePrice: number }) =>
      productsApi.link(wbId, ozonId, purchasePrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

/** Unlink products by group ID */
export const useUnlinkProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => productsApi.unlink(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
