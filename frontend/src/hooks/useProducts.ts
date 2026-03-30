import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../services/api';
import type { ProductsResponse } from '../types';

/** Fetch all products for the current user */
export const useProducts = (marketplace?: string) => {
  return useQuery<ProductsResponse>({
    queryKey: marketplace ? ['products', marketplace] : ['products'],
    queryFn: () => productsApi.getAll(marketplace),
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

/** Bulk reorder products — optimistic update для мгновенного UI */
export const useReorderProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { product_id: string; sort_order: number }[]) =>
      productsApi.reorder(items),
    onMutate: async (items) => {
      // Отменяем текущие запросы чтобы не перезаписали наш optimistic update
      await queryClient.cancelQueries({ queryKey: ['products'] });

      // Сохраняем предыдущее состояние для rollback
      const previous = queryClient.getQueryData<ProductsResponse>(['products']);

      // Оптимистично обновляем кэш
      if (previous?.products) {
        const orderMap = new Map(items.map((item) => [item.product_id, item.sort_order]));
        const updated = previous.products.map((p) => {
          const newOrder = orderMap.get(p.id);
          return newOrder !== undefined ? { ...p, sort_order: newOrder } : p;
        });
        queryClient.setQueryData<ProductsResponse>(['products'], {
          ...previous,
          products: updated,
        });
      }

      return { previous };
    },
    onError: (_err, _items, context) => {
      // Rollback при ошибке
      if (context?.previous) {
        queryClient.setQueryData(['products'], context.previous);
      }
    },
    onSettled: () => {
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
