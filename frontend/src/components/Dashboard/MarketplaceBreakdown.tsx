/**
 * Разбивка метрик по WB и Ozon
 * OZON: карточка начислений (как в ЛК) + детализация
 * WB: карточка начислений (как в ЛК) + детализация
 */
import { useState } from 'react';
import { OzonAccrualsCard } from './OzonAccrualsCard';
import { WbAccrualsCard } from './WbAccrualsCard';
import type { DashboardFilters } from '../../types';

interface MarketplaceBreakdownProps {
  filters: DashboardFilters;
}

export const MarketplaceBreakdown = ({ filters }: MarketplaceBreakdownProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toggleDetails = () => setDetailsOpen((v) => !v);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
      {/* OZON — accruals summary card */}
      <OzonAccrualsCard filters={filters} detailsOpen={detailsOpen} onToggleDetails={toggleDetails} />

      {/* WB — accruals summary card (как в ЛК, из reportDetailByPeriod через costs-tree) */}
      <WbAccrualsCard filters={filters} detailsOpen={detailsOpen} onToggleDetails={toggleDetails} />
    </div>
  );
};
