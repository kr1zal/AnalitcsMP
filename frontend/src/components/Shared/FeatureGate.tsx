import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../hooks/useSubscription';
import type { SubscriptionFeatures } from '../../types';

interface FeatureGateProps {
  feature: keyof SubscriptionFeatures;
  children: React.ReactNode;
  /** If true, hides the content entirely instead of showing overlay */
  hide?: boolean;
}

const MIN_PLAN_MAP: Partial<Record<keyof SubscriptionFeatures, string>> = {
  unit_economics: 'Pro',
  ads_page: 'Pro',
  pdf_export: 'Pro',
  fbs_analytics: 'Pro',
  order_monitor: 'Business',
  api_access: 'Business',
  profit_chart: 'Pro',
  drr_chart: 'Pro',
  conversion_chart: 'Pro',
  profit_waterfall: 'Pro',
  top_products: 'Pro',
  costs_donut: 'Pro',
  mp_breakdown: 'Pro',
  stock_forecast: 'Pro',
  stock_history: 'Pro',
};

export function FeatureGate({ feature, children, hide }: FeatureGateProps) {
  const navigate = useNavigate();
  const { data: sub, isLoading } = useSubscription();

  const hasAccess = sub?.features?.[feature] ?? false;

  // While loading — show locked state (safe default), not open content
  if (isLoading && !hasAccess) {
    if (hide) return null;
    // Show skeleton placeholder while loading
    return (
      <div className="relative min-h-[120px] rounded-2xl overflow-hidden">
        <div className="animate-pulse bg-gray-100 rounded-xl h-full min-h-[120px]" />
      </div>
    );
  }

  if (hasAccess) return <>{children}</>;

  if (hide) return null;

  const minPlan = MIN_PLAN_MAP[feature] ?? 'Pro';

  return (
    <div className="relative min-h-[120px] rounded-2xl overflow-hidden">
      {/* inert prevents Tab focus into locked content */}
      <div className="pointer-events-none opacity-30 blur-[2px] select-none overflow-hidden" inert>
        {children}
      </div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-2xl"
        role="region"
        aria-label={`Функция заблокирована. Доступно на тарифе ${minPlan}`}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 mb-2">
          <Lock className="w-5 h-5 text-indigo-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">
          Доступно на тарифе {minPlan}
        </p>
        <button
          onClick={() => navigate('/settings?tab=billing')}
          className="mt-2 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 transition-colors"
        >
          Перейти на {minPlan}
        </button>
      </div>
    </div>
  );
}
