import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, CreditCard, XOctagon, CalendarOff, RefreshCw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription, usePlans, useUpgrade, useCancelSubscription, useEnableAutoRenew } from '../../hooks/useSubscription';
import type { PlanDefinition, SubscriptionFeatures } from '../../types';

const FEATURE_LABELS: Record<keyof SubscriptionFeatures, string> = {
  dashboard: 'Дашборд',
  costs_tree_basic: 'Удержания (базовый)',
  costs_tree_details: 'Удержания (детализация)',
  unit_economics: 'Unit-экономика',
  ads_page: 'Реклама и ДРР',
  pdf_export: 'PDF экспорт',
  period_comparison: 'Сравнение периодов',
  order_monitor: 'Монитор заказов',
  api_access: 'API доступ',
  fbs_analytics: 'FBO/FBS аналитика',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-300',
  pro: 'bg-indigo-50 text-indigo-700 border-indigo-400',
  business: 'bg-amber-50 text-amber-700 border-amber-400',
};

function FeatureCheck({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircle className="w-4 h-4 text-green-500" />
  ) : (
    <XCircle className="w-4 h-4 text-gray-300" />
  );
}

export function SubscriptionCard() {
  const { data: sub, isLoading: subLoading } = useSubscription();
  const { data: plansData, isLoading: plansLoading } = usePlans();
  const upgradeMut = useUpgrade();
  const cancelMut = useCancelSubscription();
  const enableMut = useEnableAutoRenew();
  const [upgrading, setUpgrading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  if (subLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sub || !plansData) return null;

  const plans = plansData.plans;

  const handleUpgrade = async (plan: string) => {
    setUpgrading(true);
    try {
      const result = await upgradeMut.mutateAsync(plan);
      if (result.confirmation_url) {
        window.location.href = result.confirmation_url;
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Ошибка создания платежа');
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync();
      toast.success('Автопродление отключено');
    } catch {
      toast.error('Ошибка отмены автопродления');
    }
  };

  const handleEnableAutoRenew = async () => {
    try {
      await enableMut.mutateAsync();
      toast.success('Автопродление включено');
    } catch {
      toast.error('Ошибка включения автопродления');
    }
  };

  return (
    <div className="space-y-4">
      {/* Current plan badge + usage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${PLAN_COLORS[sub.plan] ?? PLAN_COLORS.free}`}
          >
            {sub.plan_name}
          </span>
          {sub.plan !== 'free' && (
            <span className="text-xs text-gray-500">
              {sub.status === 'active' ? 'Активен' : 'Неактивен'}
            </span>
          )}
        </div>
        {sub.limits.max_sku !== null && (
          <div className="text-sm text-gray-600">
            SKU: <span className="font-medium">{sub.limits.current_sku}</span> / {sub.limits.max_sku}
          </div>
        )}
      </div>

      {/* SKU usage bar */}
      {sub.limits.max_sku !== null && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              sub.limits.current_sku >= sub.limits.max_sku
                ? 'bg-red-500'
                : sub.limits.current_sku >= sub.limits.max_sku * 0.8
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
            }`}
            style={{
              width: `${Math.min(100, (sub.limits.current_sku / sub.limits.max_sku) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* Plans comparison — collapsible */}
      <button
        type="button"
        onClick={() => setShowPlans(!showPlans)}
        className="w-full flex items-center justify-between py-2 px-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span>Сравнить тарифы</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showPlans ? 'rotate-180' : ''}`} />
      </button>

      {showPlans && (
        <div className="overflow-x-auto -mx-1 animate-in slide-in-from-top-2 duration-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-500 w-1/4"></th>
                {plans.map((plan: PlanDefinition) => (
                  <th
                    key={plan.id}
                    className={`text-center py-2 px-2 font-medium ${
                      plan.id === sub.plan ? 'text-indigo-700' : 'text-gray-700'
                    }`}
                  >
                    <div>{plan.name}</div>
                    <div className="text-xs font-normal text-gray-400">
                      {plan.price_rub === 0 ? 'Бесплатно' : `${plan.price_rub} ₽/мес`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-1.5 px-2 text-gray-500">Макс. SKU</td>
                {plans.map((plan: PlanDefinition) => (
                  <td key={plan.id} className="py-1.5 px-2 text-center">
                    {plan.max_sku === null ? '∞' : plan.max_sku}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-gray-500">Маркетплейсы</td>
                {plans.map((plan: PlanDefinition) => (
                  <td key={plan.id} className="py-1.5 px-2 text-center text-xs">
                    {plan.marketplaces.map((m) => m.toUpperCase()).join(' + ')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-gray-500">Авто-синхра</td>
                {plans.map((plan: PlanDefinition) => (
                  <td key={plan.id} className="py-1.5 px-2 text-center">
                    {plan.auto_sync ? (
                      <span className="text-xs">каждые {plan.sync_interval_hours}ч</span>
                    ) : (
                      <span className="text-xs">2 раза/день</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-gray-500">Ручные обновления</td>
                {plans.map((plan: PlanDefinition) => (
                  <td key={plan.id} className="py-1.5 px-2 text-center text-xs">
                    {plan.manual_sync_limit === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span>{plan.manual_sync_limit}/день</span>
                    )}
                  </td>
                ))}
              </tr>
              {(Object.keys(FEATURE_LABELS) as (keyof SubscriptionFeatures)[])
                .filter((f) => f !== 'dashboard' && f !== 'costs_tree_basic')
                .map((feature) => (
                  <tr key={feature}>
                    <td className="py-1.5 px-2 text-gray-500">{FEATURE_LABELS[feature]}</td>
                    {plans.map((plan: PlanDefinition) => (
                      <td key={plan.id} className="py-1.5 px-2">
                        <div className="flex justify-center">
                          <FeatureCheck enabled={plan.features[feature]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CTA — Upgrade / Cancel */}
      {sub.plan === 'free' && (
        <button
          onClick={() => handleUpgrade('pro')}
          disabled={upgrading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200/50"
        >
          {upgrading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Переход к оплате...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Подключить Pro — 1 490 ₽/мес
            </>
          )}
        </button>
      )}

      {sub.plan !== 'free' && (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm text-green-800 font-medium">
              Тариф {sub.plan_name} активен
            </p>
          </div>
          {sub.auto_renew ? (
            <button
              onClick={handleCancel}
              disabled={cancelMut.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
            >
              {cancelMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XOctagon className="w-3.5 h-3.5" />
              )}
              Отменить автопродление
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <CalendarOff className="w-3.5 h-3.5" />
                <span>
                  Автопродление отключено
                  {sub.expires_at && (
                    <> — активен до {new Date(sub.expires_at).toLocaleDateString('ru-RU')}</>
                  )}
                </span>
              </div>
              <button
                onClick={handleEnableAutoRenew}
                disabled={enableMut.isPending}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-1"
              >
                {enableMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Включить автопродление
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
