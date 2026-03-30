import { useRef, useCallback } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import type { Product } from '../../../types';
import type { ImportPricesResponse } from './types';

function generateCsvTemplate(products: Product[], marketplace: 'wb' | 'ozon'): void {
  const BOM = '\uFEFF';
  const isWb = marketplace === 'wb';
  const header = isWb ? 'barcode;name;purchase_price' : 'offer_id;name;purchase_price';

  const filtered = products.filter(p =>
    isWb ? p.wb_nm_id != null : p.ozon_product_id != null
  );

  const rows = filtered.map(p => {
    const id = p.barcode;
    const name = p.name.replace(/;/g, ',');
    const price = p.purchase_price || '';
    return `${id};${name};${price}`;
  });

  const csv = BOM + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template_${marketplace}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface CsvToolbarProps {
  products: Product[];
}

export function CsvToolbar({ products }: CsvToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const uploadingRef = useRef(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingRef.current) return;
    uploadingRef.current = true;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post<ImportPricesResponse>(
        '/products/import-prices',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      toast.success(`Обновлено ${data.updated} из ${data.total_rows} товаров`);
      if (data.not_found.length > 0) {
        const preview = data.not_found.slice(0, 5).join(', ');
        const suffix = data.not_found.length > 5 ? ` и ещё ${data.not_found.length - 5}` : '';
        toast.error(`Не найдено: ${preview}${suffix}`);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Ошибка импорта файла';
      toast.error(msg);
    } finally {
      uploadingRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [queryClient]);

  const handleDownloadWb = useCallback(() => generateCsvTemplate(products, 'wb'), [products]);
  const handleDownloadOzon = useCallback(() => generateCsvTemplate(products, 'ozon'), [products]);
  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  return (
    <>
      <button
        onClick={handleDownloadWb}
        className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors"
      >
        <Download className="w-3 h-3" />
        Шаблон WB
      </button>
      <button
        onClick={handleDownloadOzon}
        className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors"
      >
        <Download className="w-3 h-3" />
        Шаблон Ozon
      </button>
      <button
        onClick={handleUploadClick}
        className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors"
      >
        <Upload className="w-3 h-3" />
        Загрузить
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />
    </>
  );
}
