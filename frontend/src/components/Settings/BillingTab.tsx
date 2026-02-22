/**
 * BillingTab — subscription management + payment callback handling.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SubscriptionCard } from './SubscriptionCard';

export function BillingTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle YooKassa payment callback (?payment=success/fail)
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Оплата прошла! Тариф Pro активируется в течение минуты.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      // Remove payment param, keep tab
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('payment');
      setSearchParams(newParams, { replace: true });
    } else if (paymentStatus === 'fail') {
      toast.error('Оплата не прошла. Попробуйте ещё раз.');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('payment');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Тариф и подписка</h3>
        <SubscriptionCard />
      </div>
    </div>
  );
}
