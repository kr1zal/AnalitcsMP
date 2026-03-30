/**
 * ProductsTab — product management (drag&drop, groups, CC).
 */
import { ProductManagement } from './products';

export function ProductsTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <ProductManagement />
    </div>
  );
}
