/**
 * Разбивка метрик по WB и Ozon
 * Mobile & Desktop: полные карточки с детализацией рядом
 */
import { useState } from 'react';
import { OzonAccrualsCard } from './OzonAccrualsCard';
import { WbAccrualsCard } from './WbAccrualsCard';
import type { CostsTreeResponse } from '../../types';

interface MarketplaceBreakdownProps {
  ozonCostsTree?: CostsTreeResponse | null;
  ozonCostsTreeLoading?: boolean;
  wbCostsTree?: CostsTreeResponse | null;
  wbCostsTreeLoading?: boolean;
}

export const MarketplaceBreakdown = ({
  ozonCostsTree,
  ozonCostsTreeLoading,
  wbCostsTree,
  wbCostsTreeLoading,
}: MarketplaceBreakdownProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toggleDetails = () => setDetailsOpen((v) => !v);

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-8">
      <OzonAccrualsCard
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
        costsTreeData={ozonCostsTree}
        isLoading={ozonCostsTreeLoading}
      />
      <WbAccrualsCard
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
        costsTreeData={wbCostsTree}
        isLoading={wbCostsTreeLoading}
      />
    </div>
  );
};
