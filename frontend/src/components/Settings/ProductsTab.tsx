/**
 * ProductsTab — product management + sales plan editor.
 */
import { ProductManagement } from './ProductManagement';
import { SalesPlanEditor } from './SalesPlanEditor';

export function ProductsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <ProductManagement />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <SalesPlanEditor />
      </div>
    </div>
  );
}
