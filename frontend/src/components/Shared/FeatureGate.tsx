import { Lock, ArrowUpRight } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import type { SubscriptionFeatures } from '../../types';

interface FeatureGateProps {
  feature: keyof SubscriptionFeatures;
  children: React.ReactNode;
  /** If true, hides the content entirely instead of showing overlay */
  hide?: boolean;
}

const MIN_PLAN_MAP: Partial<Record<keyof SubscriptionFeatures, string>> = {
  costs_tree_details: 'Pro',
  unit_economics: 'Pro',
  ads_page: 'Pro',
  pdf_export: 'Pro',
  period_comparison: 'Pro',
  order_monitor: 'Business',
  api_access: 'Business',
};

export function FeatureGate({ feature, children, hide }: FeatureGateProps) {
  const { data: sub, isLoading } = useSubscription();

  // Show content while loading (optimistic)
  if (isLoading) return <>{children}</>;

  const hasAccess = sub?.features?.[feature] ?? false;

  if (hasAccess) return <>{children}</>;

  if (hide) return null;

  const minPlan = MIN_PLAN_MAP[feature] ?? 'Pro';

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 blur-[2px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl">
        <Lock className="w-8 h-8 text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">
          Доступно на тарифе {minPlan}
        </p>
        <a
          href="/settings?tab=billing"
          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Подробнее <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
