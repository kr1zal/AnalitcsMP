/**
 * PlanTab — Sales plan editor + stock alerts, wrapped in FeatureGate.
 * Month state is lifted here so both children stay in sync.
 */
import { useState } from 'react';
import { SalesPlanEditor } from './SalesPlanEditor';
import { StockPlanAlerts } from './StockPlanAlerts';
import { FeatureGate } from '../Shared/FeatureGate';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function PlanTab() {
  const [month, setMonth] = useState(getCurrentMonth);

  return (
    <FeatureGate feature="unit_economics">
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <SalesPlanEditor month={month} onMonthChange={setMonth} />
        </div>
        <StockPlanAlerts month={month} />
      </div>
    </FeatureGate>
  );
}
