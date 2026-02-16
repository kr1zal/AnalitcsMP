/**
 * Редактор плана продаж — 3 уровня детализации:
 * 1. Общий план на месяц (total)
 * 2. По маркетплейсам (WB / Ozon)
 * 3. По товарам per marketplace (tabs WB / Ozon)
 * Приоритет для completion card: total → per-MP → per-product
 */
import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Target, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSalesPlan,
  useUpsertSalesPlan,
  useSalesPlanSummary,
  useUpsertSummaryPlan,
  useResetSalesPlan,
} from '../../hooks/useSalesPlan';
import { formatCurrency } from '../../lib/utils';
import { SaveInput } from '../Shared/SaveInput';

const MONTHS_RU = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type MpTab = 'wb' | 'ozon';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_RU[m]} ${y}`;
}

// ============ Main Component ============

export function SalesPlanEditor() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [showProducts, setShowProducts] = useState(false);
  const [productTab, setProductTab] = useState<MpTab>('wb');
  const [confirmReset, setConfirmReset] = useState(false);

  // Summary plans (total + per-MP)
  const { data: summaryData, isLoading: summaryLoading } = useSalesPlanSummary(month);
  const summaryMut = useUpsertSummaryPlan();
  const summary = summaryData?.summary ?? { total: 0, wb: 0, ozon: 0 };

  // Per-product plans (only load when expanded)
  const { data: wbData, isLoading: wbLoading } = useSalesPlan(month, 'wb');
  const { data: ozonData, isLoading: ozonLoading } = useSalesPlan(month, 'ozon');
  const upsertProductMut = useUpsertSalesPlan();
  const resetMut = useResetSalesPlan();

  const activeProductData = productTab === 'wb' ? wbData : ozonData;
  const activeProductLoading = productTab === 'wb' ? wbLoading : ozonLoading;
  const productPlans = activeProductData?.plans ?? [];

  // Product-level total for active tab
  const productTabTotal = useMemo(() => {
    return productPlans.reduce((sum, p) => sum + p.plan_revenue, 0);
  }, [productPlans]);

  // Save summary plan
  const saveSummary = useCallback(
    (level: string) => async (value: number) => {
      await summaryMut.mutateAsync({ month, level, plan_revenue: value });
    },
    [month, summaryMut],
  );

  // Has any plan set?
  const hasAnyPlan = summary.total > 0 || summary.wb > 0 || summary.ozon > 0 || productTabTotal > 0;

  // Reset all plans for the month
  const handleReset = async () => {
    try {
      await resetMut.mutateAsync(month);
      setConfirmReset(false);
      toast.success('План сброшен');
    } catch {
      toast.error('Ошибка сброса');
    }
  };

  // Save per-product plan
  const saveProduct = useCallback(
    (productId: string) => async (value: number) => {
      await upsertProductMut.mutateAsync({
        month,
        marketplace: productTab,
        items: [{ product_id: productId, plan_revenue: value }],
      });
    },
    [month, productTab, upsertProductMut],
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-900">План продаж</h2>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900 w-40 text-center">
          {monthLabel(month)}
        </span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Level 1: Total plan */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Общий план на месяц
            </label>
            <SaveInput
              value={summary.total}
              onSave={saveSummary('total')}
              placeholder="Общий план ₽"
              className="w-full"
            />
          </div>

          {/* Level 2: Per-marketplace */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              По маркетплейсам
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Wildberries</div>
                <SaveInput
                  value={summary.wb}
                  onSave={saveSummary('wb')}
                  placeholder="WB ₽"
                  className="w-full"
                />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Ozon</div>
                <SaveInput
                  value={summary.ozon}
                  onSave={saveSummary('ozon')}
                  placeholder="Ozon ₽"
                  className="w-full"
                />
              </div>
            </div>
            {(summary.wb > 0 || summary.ozon > 0) && (
              <div className="text-[10px] text-gray-400 mt-1 text-right">
                Сумма: {formatCurrency(summary.wb + summary.ozon)}
              </div>
            )}
          </div>

          {/* Level 3: Per-product (collapsible) */}
          <div>
            <button
              onClick={() => setShowProducts((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showProducts ? 'rotate-0' : '-rotate-90'}`} />
              По товарам
            </button>

            {showProducts && (
              <div>
                {/* MP tabs */}
                <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5">
                  {(['wb', 'ozon'] as const).map((mp) => (
                    <button
                      key={mp}
                      onClick={() => setProductTab(mp)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                        productTab === mp
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {mp === 'wb' ? 'Wildberries' : 'Ozon'}
                    </button>
                  ))}
                </div>

                {activeProductLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  </div>
                ) : productPlans.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    Нет товаров {productTab === 'wb' ? 'WB' : 'Ozon'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productPlans.map((plan) => (
                      <div key={plan.product_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-800 truncate">{plan.product_name}</div>
                          <div className="text-[10px] text-gray-400">{plan.barcode}</div>
                        </div>
                        <SaveInput
                          value={plan.plan_revenue}
                          onSave={saveProduct(plan.product_id)}
                          className="w-32 flex-shrink-0"
                        />
                      </div>
                    ))}

                    {/* Tab total */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-600">
                        Итого {productTab === 'wb' ? 'WB' : 'Ozon'}
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 tabular-nums">
                        {formatCurrency(productTabTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset button */}
      {hasAnyPlan && !summaryLoading && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сбросить план
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Сбросить все планы на {monthLabel(month)}?</span>
              <button
                onClick={handleReset}
                disabled={resetMut.isPending}
                className="px-2.5 py-1 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {resetMut.isPending ? 'Сброс...' : 'Да'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3">
        Приоритет: общий план → по МП → по товарам. Сохранение при потере фокуса.
      </p>
    </div>
  );
}
