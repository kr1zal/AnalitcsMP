/**
 * Страница Unit-экономики (объединено с "Товары")
 */
import { useProducts, useUnitEconomics } from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { formatCurrency, formatPercent, getDateRangeFromPreset } from '../lib/utils';
import { Package, TrendingUp, TrendingDown, DollarSign, Truck, BarChart3 } from 'lucide-react';
import type { UnitEconomicsItem } from '../types';

export const UnitEconomicsPage = () => {
  const { datePreset, marketplace, customDateFrom, customDateTo } = useFiltersStore();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
  };

  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts(marketplace);

  const {
    data: unitData,
    isLoading: unitLoading,
    isFetching: unitFetching,
    error: unitError,
    refetch: refetchUnit,
  } = useUnitEconomics(filters);

  const isLoading = productsLoading || unitLoading;
  const isRefreshing = productsFetching || unitFetching;
  const error = productsError || unitError;

  if (isLoading) {
    return <LoadingSpinner text="Загрузка unit-экономики..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Ошибка загрузки данных: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const products = productsData?.products || [];
  const unitProducts = unitData?.products || [];

  // Агрегированная структура затрат
  const totalRevenue = unitProducts.reduce((s, p) => s + p.metrics.revenue, 0);
  const totalPurchase = unitProducts.reduce((s, p) => s + p.metrics.purchase_costs, 0);
  const totalMpCosts = unitProducts.reduce((s, p) => s + p.metrics.mp_costs, 0);
  const totalProfit = unitProducts.reduce((s, p) => s + p.metrics.net_profit, 0);
  const totalSales = unitProducts.reduce((s, p) => s + p.metrics.sales_count, 0);

  const costCategories = [
    { label: 'Продажи', value: totalRevenue, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Закупка товаров', value: totalPurchase, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Удержания МП', value: totalMpCosts, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Чистая прибыль', value: totalProfit, icon: DollarSign, color: totalProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Unit-экономика</h2>
        <p className="text-sm text-gray-600 mt-1">
          Товары + прибыль на единицу с учётом удержаний и закупки
        </p>
      </div>

      {/* Фильтры */}
      <FilterPanel
        onRefresh={() => {
          refetchProducts();
          refetchUnit();
        }}
        isRefreshing={isRefreshing}
      />

      {/* Period label */}
      <div className="text-sm text-gray-500 mb-6">
        Период: {dateRange.from} — {dateRange.to}
      </div>

      {/* Карточки товаров */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {products.map((product) => {
          const unit = unitProducts.find((u) => u.product.id === product.id);
          return (
            <div
              key={product.id}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 text-white"
            >
              <h3 className="font-semibold text-sm mb-3 leading-tight">{product.name}</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Кол-во:</span>
                  <span className="font-medium">{unit?.metrics.sales_count ?? 0} шт</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Продажи:</span>
                  <span className="font-medium">{formatCurrency(unit?.metrics.revenue ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Прибыль/шт:</span>
                  <span className={`font-semibold ${(unit?.metrics.unit_profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(unit?.metrics.unit_profit ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-700">
                  <span className="text-gray-400">Закупка:</span>
                  <span>{formatCurrency(product.purchase_price)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Структура затрат (агрегированная) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Структура затрат (все товары)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {costCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={idx} className={`rounded-lg p-4 ${cat.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-xs text-gray-600">{cat.label}</span>
                </div>
                <div className={`text-xl font-bold ${cat.color}`}>
                  {formatCurrency(cat.value)}
                </div>
                {totalRevenue > 0 && cat.label !== 'Продажи' && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatPercent(Math.abs(cat.value) / totalRevenue * 100)} от продаж
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Прогресс-бар распределения */}
        {totalRevenue > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-0.5 h-4 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${(totalPurchase / totalRevenue) * 100}%` }}
              />
              <div
                className="h-full bg-purple-400"
                style={{ width: `${(totalMpCosts / totalRevenue) * 100}%` }}
              />
              <div
                className={`h-full ${totalProfit >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                style={{ width: `${(Math.abs(totalProfit) / totalRevenue) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Закупка ({formatPercent(totalPurchase / totalRevenue * 100)})</span>
              <span>Удержания МП ({formatPercent(totalMpCosts / totalRevenue * 100)})</span>
              <span>Прибыль ({formatPercent(Math.abs(totalProfit) / totalRevenue * 100)})</span>
            </div>
          </div>
        )}
      </div>

      {/* Таблица эффективности */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Таблица эффективности по товарам</h3>
          <p className="text-xs text-gray-500 mt-1">Unit-экономика за выбранный период</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Кол-во</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Продажи</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Закупка</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Удержания МП</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">На ед.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Маржа</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unitProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                unitProducts.map((item: UnitEconomicsItem) => {
                  const margin = item.metrics.revenue > 0
                    ? (item.metrics.net_profit / item.metrics.revenue) * 100
                    : 0;
                  const isPositive = item.metrics.net_profit >= 0;

                  return (
                    <tr key={item.product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-xs text-gray-400">{item.product.barcode}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{item.metrics.sales_count}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(item.metrics.revenue)}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-600">{formatCurrency(item.metrics.purchase_costs)}</td>
                      <td className="px-4 py-3 text-right text-sm text-purple-600">{formatCurrency(item.metrics.mp_costs)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.metrics.net_profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.metrics.unit_profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3 text-green-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(margin)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {unitProducts.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-sm">ИТОГО</td>
                  <td className="px-4 py-3 text-right text-sm">{totalSales}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(totalRevenue)}</td>
                  <td className="px-4 py-3 text-right text-sm text-amber-600">{formatCurrency(totalPurchase)}</td>
                  <td className="px-4 py-3 text-right text-sm text-purple-600">{formatCurrency(totalMpCosts)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(totalProfit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {totalSales > 0 ? formatCurrency(totalProfit / totalSales) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {totalRevenue > 0 ? formatPercent(totalProfit / totalRevenue * 100) : '—'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
