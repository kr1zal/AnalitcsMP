/**
 * Hook для управления экспортом в Excel и PDF
 * Управляет состоянием загрузки, скачиванием файлов и уведомлениями
 *
 * PDF экспорт: через Playwright на backend (идеальное качество)
 * Excel экспорт: через xlsx на frontend
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateExcelReport, type ExcelExportData } from '../lib/exportExcel';
import { exportApi } from '../services/api';

// ==================== ТИПЫ ====================

export type ExportType = 'excel' | 'pdf' | null;

export interface PdfExportParams {
  period: { from: string; to: string };
  marketplace: string;
}

export interface UseExportReturn {
  /** Идёт ли экспорт */
  isExporting: boolean;
  /** Тип текущего экспорта (для показа loading на нужной кнопке) */
  exportType: ExportType;
  /** Экспорт в Excel */
  exportExcel: (data: ExcelExportData) => Promise<void>;
  /** Экспорт в PDF (через backend Playwright) */
  exportPdf: (params: PdfExportParams) => Promise<void>;
}

// ==================== HOOK ====================

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(null);

  /**
   * Скачать Blob как файл
   */
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Генерация имени файла
   */
  const generateFilename = useCallback(
    (periodFrom: string, periodTo: string, extension: string) => {
      return `analytics_${periodFrom}_${periodTo}.${extension}`;
    },
    []
  );

  /**
   * Экспорт в Excel
   */
  const exportExcel = useCallback(
    async (data: ExcelExportData) => {
      if (isExporting) return;

      setIsExporting(true);
      setExportType('excel');

      // Показываем toast о начале экспорта
      const loadingToastId = toast.loading('Формируем Excel отчёт...');

      try {
        const blob = await generateExcelReport(data);
        const filename = generateFilename(data.period.from, data.period.to, 'xlsx');
        downloadBlob(blob, filename);

        toast.success('Excel отчёт сохранён', {
          id: loadingToastId, // Заменяем loading toast на success
          description: filename,
        });
      } catch (error) {
        console.error('Excel export error:', error);
        toast.error('Ошибка экспорта в Excel', {
          id: loadingToastId, // Заменяем loading toast на error
          description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        });
      } finally {
        setIsExporting(false);
        setExportType(null);
      }
    },
    [isExporting, downloadBlob, generateFilename]
  );

  /**
   * Экспорт в PDF (через Playwright на backend)
   */
  const exportPdf = useCallback(
    async (params: PdfExportParams) => {
      if (isExporting) return;

      setIsExporting(true);
      setExportType('pdf');

      // Показываем toast о начале экспорта
      const loadingToastId = toast.loading('Формируем PDF отчёт...', {
        description: 'Это может занять 10-20 секунд',
      });

      try {
        const blob = await exportApi.exportPdf({
          date_from: params.period.from,
          date_to: params.period.to,
          marketplace: params.marketplace,
        });
        const filename = generateFilename(params.period.from, params.period.to, 'pdf');
        downloadBlob(blob, filename);

        toast.success('PDF отчёт сохранён', {
          id: loadingToastId,
          description: filename,
        });
      } catch (error) {
        console.error('PDF export error:', error);
        toast.error('Ошибка экспорта в PDF', {
          id: loadingToastId,
          description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        });
      } finally {
        setIsExporting(false);
        setExportType(null);
      }
    },
    [isExporting, downloadBlob, generateFilename]
  );

  return {
    isExporting,
    exportType,
    exportExcel,
    exportPdf,
  };
}
