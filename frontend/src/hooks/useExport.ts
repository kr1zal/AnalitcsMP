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

// ==================== HOOK ====================

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(null);

  /** MIME types by extension — axios blob responses often have empty type */
  const MIME_MAP: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  /**
   * Скачать Blob как файл
   * На мобильных (iOS Safari) <a download> не работает с blob URLs —
   * используем navigator.share() (нативный share sheet) с fallback
   */
  const downloadBlob = useCallback(async (blob: Blob, filename: string) => {
    // Ensure correct MIME type (axios blob often comes without type)
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeType = MIME_MAP[ext] || blob.type || 'application/octet-stream';
    const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });

    // Mobile: try Web Share API (native share sheet — best UX on iOS/Android)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        const file = new File([typedBlob], filename, { type: mimeType });
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e) {
        // AbortError = user cancelled share → done
        if ((e as DOMException).name === 'AbortError') return;
        // Other errors → fall through to link approach
      }
    }

    // Desktop (and mobile fallback): blob URL + <a download>
    const url = URL.createObjectURL(typedBlob);
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
        await downloadBlob(blob, filename);

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
          fulfillment_type: params.fulfillment_type,
        });
        const filename = generateFilename(params.period.from, params.period.to, 'pdf');
        await downloadBlob(blob, filename);

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
