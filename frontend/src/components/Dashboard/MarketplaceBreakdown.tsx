/**
 * Разбивка метрик по WB и Ozon
 * Mobile & Desktop: полные карточки с детализацией рядом
 */
import { useState } from 'react';
import { OzonAccrualsCard } from './OzonAccrualsCard';
import { WbAccrualsCard } from './WbAccrualsCard';
import type { CostsTreeResponse, MpProfitData } from '../../types';

interface MarketplaceBreakdownProps {
  ozonCostsTree?: CostsTreeResponse | null;
  ozonCostsTreeLoading?: boolean;
  wbCostsTree?: CostsTreeResponse | null;
  wbCostsTreeLoading?: boolean;
  ozonProfit?: MpProfitData | null;
  wbProfit?: MpProfitData | null;
}

export const MarketplaceBreakdown = ({
  ozonCostsTree,
  ozonCostsTreeLoading,
  wbCostsTree,
  wbCostsTreeLoading,
  ozonProfit,
  wbProfit,
}: MarketplaceBreakdownProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toggleDetails = () => setDetailsOpen((v) => !v);

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
      <OzonAccrualsCard
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
        costsTreeData={ozonCostsTree}
        isLoading={ozonCostsTreeLoading}
        profitData={ozonProfit}
      />
      <WbAccrualsCard
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
        costsTreeData={wbCostsTree}
        isLoading={wbCostsTreeLoading}
        profitData={wbProfit}
      />
    </div>
  );
};
