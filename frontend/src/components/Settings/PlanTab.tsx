/**
 * PlanTab — Sales plan editor wrapped in FeatureGate.
 */
import { SalesPlanEditor } from './SalesPlanEditor';
import { FeatureGate } from '../Shared/FeatureGate';

export function PlanTab() {
  return (
    <FeatureGate feature="unit_economics">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <SalesPlanEditor />
      </div>
    </FeatureGate>
  );
}
