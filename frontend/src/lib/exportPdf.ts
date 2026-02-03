/**
 * PDF Export Utility
 * Генерация PDF отчёта с 3 страницами (Dashboard, Ads, Unit Economics)
 * через html2canvas + jsPDF
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from './utils';

// ==================== ТИПЫ ====================

export interface PdfExportConfig {
  /** Элемент страницы Dashboard для захвата */
  dashboardElement: HTMLElement | null;
  /** Элемент страницы Ads для захвата */
  adsElement: HTMLElement | null;
  /** Элемент страницы Unit Economics для захвата */
  unitEconomicsElement: HTMLElement | null;
  /** Период отчёта */
  period: { from: string; to: string };
  /** Маркетплейс */
  marketplace: string;
}

interface PageConfig {
  title: string;
  subtitle: string;
}

// ==================== КОНСТАНТЫ ====================

// A4 Landscape в мм
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 10;
const HEADER_HEIGHT = 20;

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================

export async function generatePdfReport(config: PdfExportConfig): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const periodStr = `${formatDate(config.period.from)} - ${formatDate(config.period.to)}`;
  let pageIndex = 0;

  // Страница 1: Dashboard
  if (config.dashboardElement) {
    if (pageIndex > 0) pdf.addPage();
    await addPageFromElement(pdf, config.dashboardElement, {
      title: 'Дашборд',
      subtitle: periodStr,
    });
    pageIndex++;
  }

  // Страница 2: Ads
  if (config.adsElement) {
    if (pageIndex > 0) pdf.addPage();
    await addPageFromElement(pdf, config.adsElement, {
      title: 'Рекламные расходы',
      subtitle: periodStr,
    });
    pageIndex++;
  }

  // Страница 3: Unit Economics
  if (config.unitEconomicsElement) {
    if (pageIndex > 0) pdf.addPage();
    await addPageFromElement(pdf, config.unitEconomicsElement, {
      title: 'Unit-экономика',
      subtitle: periodStr,
    });
    pageIndex++;
  }

  // Если ничего не было добавлено — пустая страница с сообщением
  if (pageIndex === 0) {
    pdf.setFontSize(16);
    pdf.text('Нет данных для экспорта', MARGIN, MARGIN + 20);
  }

  return pdf.output('blob');
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Добавить страницу из HTML элемента
 */
async function addPageFromElement(
  pdf: jsPDF,
  element: HTMLElement,
  pageConfig: PageConfig
): Promise<void> {
  // Клонируем элемент для рендеринга (чтобы не влиять на исходный DOM)
  const clone = element.cloneNode(true) as HTMLElement;

  // Настраиваем клон для корректного рендеринга
  clone.style.width = '1200px';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.background = '#ffffff';

  // Убираем скроллы и overflow
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';

  // Скрываем элементы, которые не должны попасть в PDF
  const hiddenElements = clone.querySelectorAll('[data-pdf-hide]');
  hiddenElements.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  document.body.appendChild(clone);

  try {
    // Рендерим в canvas
    const canvas = await html2canvas(clone, {
      scale: 2, // Высокое разрешение
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      // Ограничиваем высоту для предсказуемого результата
      height: Math.min(clone.scrollHeight, 2000),
      windowWidth: 1200,
    });

    // Добавляем заголовок страницы
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(pageConfig.title, MARGIN, MARGIN + 6);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(pageConfig.subtitle, MARGIN, MARGIN + 12);

    // Рассчитываем размеры изображения
    const imgWidth = PAGE_WIDTH - 2 * MARGIN;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Ограничиваем высоту изображения доступным пространством
    const availableHeight = PAGE_HEIGHT - HEADER_HEIGHT - MARGIN;
    const finalHeight = Math.min(imgHeight, availableHeight);

    // Добавляем изображение
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(
      imgData,
      'PNG',
      MARGIN,
      HEADER_HEIGHT,
      imgWidth,
      finalHeight
    );
  } finally {
    // Удаляем клон из DOM
    document.body.removeChild(clone);
  }
}

/**
 * Захватить конкретный элемент как изображение для PDF
 * Используется для отдельных секций (графики, таблицы)
 */
export async function captureElementAsImage(
  element: HTMLElement
): Promise<string | null> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to capture element:', error);
    return null;
  }
}
