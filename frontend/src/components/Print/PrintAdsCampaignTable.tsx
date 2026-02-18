/**
 * PrintAdsCampaignTable — Compact top-10 campaign table for PDF
 * Designed to fit alongside PrintAdsOverview on a single A4 page
 */
import { COLORS, DRR_THRESHOLDS } from './print-constants';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/utils';
import type { AdCampaignItem } from '../../types';

interface PrintAdsCampaignTableProps {
  campaigns: AdCampaignItem[];
}

const MAX_CAMPAIGNS = 10;

export function PrintAdsCampaignTable({ campaigns }: PrintAdsCampaignTableProps) {
  const topCampaigns = campaigns.slice(0, MAX_CAMPAIGNS);
  const totalCount = campaigns.length;
  const hasMore = totalCount > MAX_CAMPAIGNS;

  // Summary totals
  const totalCost = campaigns.reduce((s, c) => s + c.cost, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalOrders = campaigns.reduce((s, c) => s + c.orders, 0);
  const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const totalCpc = totalClicks > 0 ? totalCost / totalClicks : 0;

  const getDrrColor = (drr: number) =>
    drr > DRR_THRESHOLDS.high ? COLORS.red : drr > DRR_THRESHOLDS.medium ? COLORS.amber : COLORS.emerald;

  const getMpLabel = (mp: string) =>
    mp === 'wb' ? 'WB' : 'Ozon';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-gray-900">Рекламные кампании</h3>
        <span className="text-[10px] text-gray-400">
          {hasMore ? `Топ ${MAX_CAMPAIGNS} из ${totalCount}` : `${totalCount} кампаний`}
        </span>
      </div>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Кампания</th>
            <th className="text-center py-1.5 px-1 font-medium text-gray-600 w-10">МП</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">Расход</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">Показы</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">Клики</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">CTR</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">Заказы</th>
            <th className="text-right py-1.5 px-1 font-medium text-gray-600">ДРР</th>
            <th className="text-right py-1.5 pl-1 font-medium text-gray-600">CPC</th>
          </tr>
        </thead>
        <tbody>
          {topCampaigns.map((c) => (
            <tr key={`${c.campaign_id}-${c.marketplace}`} className="border-b border-gray-100">
              <td className="py-1.5 pr-2 text-gray-900 font-medium">
                <div className="truncate max-w-[180px]" title={c.campaign_name}>
                  {c.campaign_name || `#${c.campaign_id.slice(0, 8)}`}
                </div>
                {c.product_name && (
                  <div className="text-[9px] text-gray-400 truncate max-w-[180px]">{c.product_name}</div>
                )}
              </td>
              <td className="py-1.5 px-1 text-center">
                <span
                  className="px-1 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    backgroundColor: c.marketplace === 'wb' ? '#ede9fe' : '#dbeafe',
                    color: c.marketplace === 'wb' ? '#7c3aed' : '#2563eb',
                  }}
                >
                  {getMpLabel(c.marketplace)}
                </span>
              </td>
              <td className="py-1.5 px-1 text-right tabular-nums font-medium" style={{ color: COLORS.red }}>
                {formatCurrency(c.cost)}
              </td>
              <td className="py-1.5 px-1 text-right tabular-nums text-gray-700">{formatNumber(c.impressions)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums text-gray-700">{formatNumber(c.clicks)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums text-gray-700">{formatPercent(c.ctr)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums text-gray-700">{formatNumber(c.orders)}</td>
              <td className="py-1.5 px-1 text-right tabular-nums font-medium" style={{ color: getDrrColor(c.drr) }}>
                {formatPercent(c.drr)}
              </td>
              <td className="py-1.5 pl-1 text-right tabular-nums text-gray-700">{formatCurrency(c.cpc)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 font-semibold">
            <td className="py-1.5 pr-2 text-gray-900">ИТОГО</td>
            <td className="py-1.5 px-1" />
            <td className="py-1.5 px-1 text-right tabular-nums" style={{ color: COLORS.red }}>{formatCurrency(totalCost)}</td>
            <td className="py-1.5 px-1 text-right tabular-nums text-gray-900">{formatNumber(totalImpressions)}</td>
            <td className="py-1.5 px-1 text-right tabular-nums text-gray-900">{formatNumber(totalClicks)}</td>
            <td className="py-1.5 px-1 text-right tabular-nums text-gray-700">{formatPercent(totalCtr)}</td>
            <td className="py-1.5 px-1 text-right tabular-nums text-gray-900">{formatNumber(totalOrders)}</td>
            <td className="py-1.5 px-1 text-right text-gray-500">—</td>
            <td className="py-1.5 pl-1 text-right tabular-nums text-gray-700">{formatCurrency(totalCpc)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
