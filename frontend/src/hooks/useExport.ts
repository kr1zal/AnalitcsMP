/**
 * Hook для управления экспортом в Excel и PDF
 * Управляет состоянием загрузки, скачиванием файлов и уведомлениями
 *
 * PDF экспорт: через Playwright на backend (идеальное качество)
 * Excel экспорт: через xlsx на frontend
 *
 * Mobile (iOS Safari): <a download> и navigator.share() не работают после async —
 * iOS требует свежий user gesture. Решение: показываем toast с кнопкой "Сохранить",
 * клик на неё = свежий gesture → navigator.share() открывает нативный share sheet.
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
  fulfillment_type?: string;
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

// ==================== CONSTANTS ====================

/** MIME types by extension — axios blob responses often have empty type */
const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// ==================== HOOK ====================

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(null);

  /**
   * Ensure blob has correct MIME type (axios blob often comes without type)
   */
  const ensureMime = useCallback((blob: Blob, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeType = MIME_MAP[ext] || blob.type || 'application/octet-stream';
    const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    return { typedBlob, mimeType };
  }, []);

  /**
   * Desktop: стандартный blob download через <a download>
   */
  const downloadDesktop = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    setTimeout(() => {
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);
    }, 0);
  }, []);

  /**
   * Mobile: показать toast с кнопкой "Сохранить"
   * Клик на кнопку = свежий user gesture → navigator.share() работает
   * Returns false = pending (mobile), true = auto-downloaded (desktop)
   */
  const downloadBlob = useCallback((blob: Blob, filename: string): boolean => {
    const { typedBlob, mimeType } = ensureMime(blob, filename);

    if (IS_MOBILE && navigator.share) {
      const file = new File([typedBlob], filename, { type: mimeType });
      toast('Файл готов', {
        description: filename,
        duration: 60000,
        action: {
          label: 'Сохранить',
          onClick: () => {
            navigator.share({ files: [file] }).catch(() => {
              // Last resort fallback
              downloadDesktop(typedBlob, filename);
            });
          },
        },
      });
      return false; // pending user action
    }

    // Desktop: auto-download
    downloadDesktop(typedBlob, filename);
    return true;
  }, [ensureMime, downloadDesktop]);

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

      const loadingToastId = toast.loading('Формируем Excel отчёт...');

      try {
        const blob = await generateExcelReport(data);
        const filename = generateFilename(data.period.from, data.period.to, 'xlsx');
        const autoDownloaded = downloadBlob(blob, filename);

        if (autoDownloaded) {
          toast.success('Excel отчёт сохранён', {
            id: loadingToastId,
            description: filename,
          });
        } else {
          toast.dismiss(loadingToastId);
        }
      } catch (error) {
        console.error('Excel export error:', error);
        toast.error('Ошибка экспорта в Excel', {
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

  /**
   * Экспорт в PDF (через Playwright на backend)
   */
  const exportPdf = useCallback(
    async (params: PdfExportParams) => {
      if (isExporting) return;

      setIsExporting(true);
      setExportType('pdf');

      const loadingToastId = toast.loading('Формируем PDF отчёт...', {
        description: 'Это может занять 10-20 секунд',
      });

      try {
        const blob = await exportApi.exportPdf({
          date_from: params.period.from,
          date_to: params.period.to,
          marketplace: params.marketplace,
          fulfillment_type: params.fulfillment_type,
        });
        const filename = generateFilename(params.period.from, params.period.to, 'pdf');
        const autoDownloaded = downloadBlob(blob, filename);

        if (autoDownloaded) {
          toast.success('PDF отчёт сохранён', {
            id: loadingToastId,
            description: filename,
          });
        } else {
          // Mobile: dismiss loading, downloadBlob showed save prompt
          toast.dismiss(loadingToastId);
        }
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
