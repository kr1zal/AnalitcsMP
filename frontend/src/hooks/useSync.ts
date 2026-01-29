/**
 * React Query hooks для синхронизации данных
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi } from '../services/api';
import { toast } from 'sonner';

/**
 * Hook для получения логов синхронизации
 */
export const useSyncLogs = (limit: number = 50) => {
  return useQuery({
    queryKey: ['sync', 'logs', limit],
    queryFn: () => syncApi.getLogs(limit),
    staleTime: 1000 * 30, // 30 секунд
  });
};

/**
 * Hook для полной синхронизации
 */
export const useSyncAll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ daysBack = 30 }: { daysBack?: number }) =>
      syncApi.syncAll(daysBack, false),
    onSuccess: (data) => {
      // Инвалидируем все dashboard queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sync', 'logs'] });

      const successCount = data.success_count || 0;
      const errorCount = data.error_count || 0;

      if (errorCount === 0) {
        toast.success(`Синхронизация завершена! Обновлено ${successCount} источников.`);
      } else {
        toast.warning(
          `Синхронизация завершена с ошибками. Успешно: ${successCount}, Ошибок: ${errorCount}`
        );
      }
    },
    onError: (error: any) => {
      toast.error(`Ошибка синхронизации: ${error.message || 'Неизвестная ошибка'}`);
    },
  });
};

/**
 * Hook для синхронизации продаж
 */
export const useSyncSales = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ daysBack = 7, marketplace }: { daysBack?: number; marketplace?: string }) =>
      syncApi.syncSales(daysBack, marketplace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sync', 'logs'] });
      toast.success('Продажи синхронизированы');
    },
    onError: (error: any) => {
      toast.error(`Ошибка синхронизации продаж: ${error.message}`);
    },
  });
};

/**
 * Hook для синхронизации остатков
 */
export const useSyncStocks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ marketplace }: { marketplace?: string }) =>
      syncApi.syncStocks(marketplace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['sync', 'logs'] });
      toast.success('Остатки синхронизированы');
    },
    onError: (error: any) => {
      toast.error(`Ошибка синхронизации остатков: ${error.message}`);
    },
  });
};
