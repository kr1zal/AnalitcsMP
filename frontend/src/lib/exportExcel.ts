/**
 * Excel Export Utility
 * Генерация Excel отчёта с 6 листами данных дашборда
 */
import * as XLSX from 'xlsx';
import { formatDate } from './utils';
import type {
  SalesSummary,
  SalesChartDataPoint,
  AdCostsChartDataPoint,
  CostsTreeResponse,
  UnitEconomicsItem,
  StockItem,
  Marketplace,
} from '../types';
import { classifyABC } from '../components/UnitEconomics/ueHelpers';

// ==================== ТИПЫ ====================

export interface ExcelExportData {
  summary: SalesSummary | null;
  period: { from: string; to: string };
  marketplace: Marketplace;
  salesChart: SalesChartDataPoint[];
  adCosts: AdCostsChartDataPoint[];
  ozonCostsTree: CostsTreeResponse | null;
  wbCostsTree: CostsTreeResponse | null;
  unitEconomics: UnitEconomicsItem[];
  stocks: StockItem[];
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================

export async function generateExcelReport(data: ExcelExportData): Promise<Blob> {
  const workbook = XLSX.utils.book_new();

  // Лист 1: Сводка
  const summarySheet = createSummarySheet(data);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  // Лист 2: Продажи по дням
  const salesSheet = createSalesSheet(data.salesChart);
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Продажи по дням');

  // Лист 3: Реклама
  const adsSheet = createAdsSheet(data.adCosts);
  XLSX.utils.book_append_sheet(workbook, adsSheet, 'Реклама');

  // Лист 4: Удержания МП
  const costsSheet = createCostsSheet(data.ozonCostsTree, data.wbCostsTree);
  XLSX.utils.book_append_sheet(workbook, costsSheet, 'Удержания МП');

  // Лист 5: Unit-экономика
  const unitEconomicsSheet = createUnitEconomicsSheet(data.unitEconomics);
  XLSX.utils.book_append_sheet(workbook, unitEconomicsSheet, 'Unit-экономика');

  // Лист 6: Остатки
  const stocksSheet = createStocksSheet(data.stocks);
  XLSX.utils.book_append_sheet(workbook, stocksSheet, 'Остатки');

  // Генерация Blob
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ==================== СОЗДАНИЕ ЛИСТОВ ====================

/**
 * Лист 1: Сводка метрик (разделена по маркетплейсам)
 */
function createSummarySheet(data: ExcelExportData): XLSX.WorkSheet {
  const periodStr = `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`;

  const rows: (string | number)[][] = [
    ['АНАЛИТИКА МАРКЕТПЛЕЙСОВ', '', '', ''],
    ['', '', '', ''],
    ['Период:', periodStr, '', ''],
    ['', '', '', ''],
  ];

  // Заголовки колонок
  rows.push(['МЕТРИКА', 'OZON', 'WB', 'ИТОГО']);
  rows.push(['', '', '', '']);

  // Данные из costs-tree для каждого МП
  const ozon = data.ozonCostsTree;
  const wb = data.wbCostsTree;

  // Продажи (выручка)
  const ozonSales = ozon?.tree.find(c => c.name === 'Продажи')?.amount ?? 0;
  const wbSales = wb?.tree.find(c => c.name === 'Продажи')?.amount ?? 0;
  rows.push(['Продажи (выручка)', ozonSales, wbSales, ozonSales + wbSales]);

  // Начислено (к перечислению)
  const ozonAccrued = ozon?.total_accrued ?? 0;
  const wbAccrued = wb?.total_accrued ?? 0;
  rows.push(['Начислено (к перечисл.)', ozonAccrued, wbAccrued, ozonAccrued + wbAccrued]);

  rows.push(['', '', '', '']);
  rows.push(['УДЕРЖАНИЯ', '', '', '']);

  // Комиссия
  const ozonCommission = ozon?.tree.find(c => c.name === 'Комиссия')?.amount ?? 0;
  const wbCommission = wb?.tree.find(c => c.name === 'Комиссия')?.amount ?? 0;
  rows.push(['  Комиссия', ozonCommission, wbCommission, ozonCommission + wbCommission]);

  // Логистика
  const ozonLogistics = ozon?.tree.find(c => c.name === 'Логистика')?.amount ?? 0;
  const wbLogistics = wb?.tree.find(c => c.name === 'Логистика')?.amount ?? 0;
  rows.push(['  Логистика', ozonLogistics, wbLogistics, ozonLogistics + wbLogistics]);

  // Хранение
  const ozonStorage = ozon?.tree.find(c => c.name === 'Хранение')?.amount ?? 0;
  const wbStorage = wb?.tree.find(c => c.name === 'Хранение')?.amount ?? 0;
  rows.push(['  Хранение', ozonStorage, wbStorage, ozonStorage + wbStorage]);

  // Эквайринг
  const ozonAcquiring = ozon?.tree.find(c => c.name === 'Эквайринг')?.amount ?? 0;
  const wbAcquiring = wb?.tree.find(c => c.name === 'Эквайринг')?.amount ?? 0;
  rows.push(['  Эквайринг', ozonAcquiring, wbAcquiring, ozonAcquiring + wbAcquiring]);

  // Штрафы
  const ozonPenalties = ozon?.tree.find(c => c.name === 'Штрафы')?.amount ?? 0;
  const wbPenalties = wb?.tree.find(c => c.name === 'Штрафы')?.amount ?? 0;
  rows.push(['  Штрафы', ozonPenalties, wbPenalties, ozonPenalties + wbPenalties]);

  // Прочее (всё остальное)
  const knownCategories = ['Продажи', 'Комиссия', 'Логистика', 'Хранение', 'Эквайринг', 'Штрафы', 'Возмещения', 'СПП'];
  const ozonOther = ozon?.tree.filter(c => !knownCategories.includes(c.name)).reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const wbOther = wb?.tree.filter(c => !knownCategories.includes(c.name)).reduce((sum, c) => sum + c.amount, 0) ?? 0;
  if (ozonOther !== 0 || wbOther !== 0) {
    rows.push(['  Прочее', ozonOther, wbOther, ozonOther + wbOther]);
  }

  // СПП (только WB)
  const wbSpp = wb?.tree.find(c => c.name === 'СПП')?.amount ?? 0;
  if (wbSpp !== 0) {
    rows.push(['  СПП (WB)', 0, wbSpp, wbSpp]);
  }

  rows.push(['', '', '', '']);

  // Общие метрики из summary
  if (data.summary) {
    rows.push(['ОБЩИЕ ПОКАЗАТЕЛИ', '', '', '']);
    rows.push(['Заказы', '', '', data.summary.orders]);
    rows.push(['Выкупы', '', '', data.summary.sales]);
    rows.push(['Возвраты', '', '', data.summary.returns]);
    rows.push(['Процент выкупа', '', '', `${data.summary.buyout_percent.toFixed(1)}%`]);
    rows.push(['Средний чек', '', '', data.summary.avg_check]);
    rows.push(['', '', '', '']);
    rows.push(['Реклама', '', '', data.summary.ad_cost]);
    rows.push(['ДРР', '', '', `${data.summary.drr.toFixed(1)}%`]);
    rows.push(['', '', '', '']);
    rows.push(['Закупка (оценка)', '', '', data.summary.purchase_costs_total ?? 0]);
    rows.push(['Прибыль (оценка)', '', '', data.summary.net_profit]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширины колонок
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

  // Merge для заголовка
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

  return ws;
}

/**
 * Лист 2: Продажи по дням
 */
function createSalesSheet(salesChart: SalesChartDataPoint[]): XLSX.WorkSheet {
  const headers = ['Дата', 'Заказы', 'Выкупы', 'Выручка', 'Ср. чек'];

  const rows: (string | number)[][] = [headers];

  for (const day of salesChart) {
    rows.push([
      formatDate(day.date),
      day.orders,
      day.sales,
      day.revenue,
      day.avg_check,
    ]);
  }

  // Итоги
  if (salesChart.length > 0) {
    const totals = salesChart.reduce(
      (acc, day) => ({
        orders: acc.orders + day.orders,
        sales: acc.sales + day.sales,
        revenue: acc.revenue + day.revenue,
      }),
      { orders: 0, sales: 0, revenue: 0 }
    );

    const avgCheck = totals.sales > 0 ? totals.revenue / totals.sales : 0;

    rows.push([]);
    rows.push([
      'ИТОГО',
      totals.orders,
      totals.sales,
      totals.revenue,
      Math.round(avgCheck * 100) / 100,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];

  return ws;
}

/**
 * Лист 3: Реклама
 */
function createAdsSheet(adCosts: AdCostsChartDataPoint[]): XLSX.WorkSheet {
  const headers = ['Дата', 'Расход', 'Выручка', 'ДРР %', 'Показы', 'Клики', 'Заказы'];

  const rows: (string | number)[][] = [headers];

  for (const day of adCosts) {
    rows.push([
      formatDate(day.date),
      day.ad_cost,
      day.revenue,
      `${day.drr.toFixed(1)}%`,
      day.impressions,
      day.clicks,
      day.orders,
    ]);
  }

  // Итоги
  if (adCosts.length > 0) {
    const totals = adCosts.reduce(
      (acc, day) => ({
        ad_cost: acc.ad_cost + day.ad_cost,
        revenue: acc.revenue + day.revenue,
        impressions: acc.impressions + day.impressions,
        clicks: acc.clicks + day.clicks,
        orders: acc.orders + day.orders,
      }),
      { ad_cost: 0, revenue: 0, impressions: 0, clicks: 0, orders: 0 }
    );

    const avgDrr = totals.revenue > 0 ? (totals.ad_cost / totals.revenue) * 100 : 0;

    rows.push([]);
    rows.push([
      'ИТОГО',
      totals.ad_cost,
      totals.revenue,
      `${avgDrr.toFixed(1)}%`,
      totals.impressions,
      totals.clicks,
      totals.orders,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];

  return ws;
}

/**
 * Лист 4: Удержания МП (flattened costs tree)
 */
function createCostsSheet(
  ozonCostsTree: CostsTreeResponse | null,
  wbCostsTree: CostsTreeResponse | null
): XLSX.WorkSheet {
  const headers = ['Маркетплейс', 'Категория', 'Подкатегория', 'Сумма', '% от продаж'];

  const rows: (string | number)[][] = [headers];

  // OZON
  if (ozonCostsTree && ozonCostsTree.tree.length > 0) {
    for (const category of ozonCostsTree.tree) {
      if (category.children && category.children.length > 0) {
        // Категория с подкатегориями
        for (const child of category.children) {
          rows.push([
            'OZON',
            category.name,
            child.name,
            child.amount,
            category.percent !== null ? `${category.percent.toFixed(1)}%` : '—',
          ]);
        }
      } else {
        // Категория без подкатегорий
        rows.push([
          'OZON',
          category.name,
          '—',
          category.amount,
          category.percent !== null ? `${category.percent.toFixed(1)}%` : '—',
        ]);
      }
    }

    // Итого OZON
    rows.push([
      'OZON',
      'ИТОГО начислено',
      '—',
      ozonCostsTree.total_accrued,
      '—',
    ]);
    rows.push([]);
  }

  // WB
  if (wbCostsTree && wbCostsTree.tree.length > 0) {
    for (const category of wbCostsTree.tree) {
      if (category.children && category.children.length > 0) {
        for (const child of category.children) {
          rows.push([
            'WB',
            category.name,
            child.name,
            child.amount,
            category.percent !== null ? `${category.percent.toFixed(1)}%` : '—',
          ]);
        }
      } else {
        rows.push([
          'WB',
          category.name,
          '—',
          category.amount,
          category.percent !== null ? `${category.percent.toFixed(1)}%` : '—',
        ]);
      }
    }

    // Итого WB
    rows.push([
      'WB',
      'ИТОГО начислено',
      '—',
      wbCostsTree.total_accrued,
      '—',
    ]);
  }

  if (rows.length === 1) {
    rows.push(['Нет данных за выбранный период', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 12 }];

  return ws;
}

/**
 * Лист 5: Unit-экономика
 */
function createUnitEconomicsSheet(unitEconomics: UnitEconomicsItem[]): XLSX.WorkSheet {
  // Compute ABC classification (by profit — default)
  const abcMap = classifyABC(unitEconomics, 'profit');
  const hasStorage = unitEconomics.some(p => (p.metrics.storage_cost ?? 0) > 0);

  const headers: string[] = [
    'ABC',
    'Товар',
    'Штрихкод',
    'Продажи шт.',
    'Выручка',
    'Удержания МП',
  ];
  if (hasStorage) headers.push('Хранение');
  headers.push('Закупка', 'Реклама', 'Прибыль', 'На единицу', 'Рентаб. %', 'ДРР %');

  const rows: (string | number)[][] = [headers];

  for (const item of unitEconomics) {
    const margin =
      item.metrics.revenue > 0
        ? (item.metrics.net_profit / item.metrics.revenue) * 100
        : 0;
    const drr = item.metrics.drr ?? 0;
    const abc = abcMap.get(item.product.id) ?? 'C';

    const row: (string | number)[] = [
      abc,
      item.product.name,
      item.product.barcode,
      item.metrics.sales_count,
      item.metrics.revenue,
      item.metrics.mp_costs,
    ];
    if (hasStorage) row.push(item.metrics.storage_cost ?? 0);
    row.push(
      item.metrics.purchase_costs,
      item.metrics.ad_cost,
      item.metrics.net_profit,
      item.metrics.unit_profit,
      `${margin.toFixed(1)}%`,
      `${drr.toFixed(1)}%`,
    );
    rows.push(row);
  }

  // Итоги
  if (unitEconomics.length > 0) {
    const totals = unitEconomics.reduce(
      (acc, item) => ({
        sales_count: acc.sales_count + item.metrics.sales_count,
        revenue: acc.revenue + item.metrics.revenue,
        mp_costs: acc.mp_costs + item.metrics.mp_costs,
        storage_cost: acc.storage_cost + (item.metrics.storage_cost ?? 0),
        purchase_costs: acc.purchase_costs + item.metrics.purchase_costs,
        ad_cost: acc.ad_cost + item.metrics.ad_cost,
        net_profit: acc.net_profit + item.metrics.net_profit,
      }),
      { sales_count: 0, revenue: 0, mp_costs: 0, storage_cost: 0, purchase_costs: 0, ad_cost: 0, net_profit: 0 }
    );

    const totalMargin =
      totals.revenue > 0 ? (totals.net_profit / totals.revenue) * 100 : 0;
    const avgUnitProfit =
      totals.sales_count > 0 ? totals.net_profit / totals.sales_count : 0;
    const totalDrr =
      totals.revenue > 0 ? (totals.ad_cost / totals.revenue) * 100 : 0;

    rows.push([]);
    const totalsRow: (string | number)[] = [
      '',
      'ИТОГО',
      '',
      totals.sales_count,
      totals.revenue,
      totals.mp_costs,
    ];
    if (hasStorage) totalsRow.push(totals.storage_cost);
    totalsRow.push(
      totals.purchase_costs,
      totals.ad_cost,
      totals.net_profit,
      Math.round(avgUnitProfit * 100) / 100,
      `${totalMargin.toFixed(1)}%`,
      `${totalDrr.toFixed(1)}%`,
    );
    rows.push(totalsRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const cols: XLSX.ColInfo[] = [
    { wch: 5 },   // ABC
    { wch: 25 },  // Товар
    { wch: 15 },  // Штрихкод
    { wch: 12 },  // Продажи
    { wch: 12 },  // Выручка
    { wch: 14 },  // Удержания МП
  ];
  if (hasStorage) cols.push({ wch: 12 }); // Хранение
  cols.push(
    { wch: 12 },  // Закупка
    { wch: 12 },  // Реклама
    { wch: 12 },  // Прибыль
    { wch: 12 },  // На единицу
    { wch: 10 },  // Рентаб.
    { wch: 10 },  // ДРР
  );
  ws['!cols'] = cols;

  return ws;
}

/**
 * Лист 6: Остатки
 */
function createStocksSheet(stocks: StockItem[]): XLSX.WorkSheet {
  const headers = ['Товар', 'Штрихкод', 'WB', 'Ozon', 'Всего', 'Статус'];

  const rows: (string | number)[][] = [headers];

  for (const stock of stocks) {
    // Подсчёт по маркетплейсам
    let wbQty = 0;
    let ozonQty = 0;

    for (const wh of stock.warehouses) {
      if (wh.marketplace === 'wb') {
        wbQty += wh.quantity;
      } else if (wh.marketplace === 'ozon') {
        ozonQty += wh.quantity;
      }
    }

    // Статус
    let status = 'OK';
    if (stock.total_quantity === 0) {
      status = 'OOS';
    } else if (stock.total_quantity < 10) {
      status = 'Критично';
    } else if (stock.total_quantity < 30) {
      status = 'Мало';
    }

    rows.push([
      stock.product_name,
      stock.barcode,
      wbQty,
      ozonQty,
      stock.total_quantity,
      status,
    ]);
  }

  // Итоги
  if (stocks.length > 0) {
    const totals = stocks.reduce(
      (acc, stock) => {
        let wbQty = 0;
        let ozonQty = 0;
        for (const wh of stock.warehouses) {
          if (wh.marketplace === 'wb') wbQty += wh.quantity;
          else if (wh.marketplace === 'ozon') ozonQty += wh.quantity;
        }
        return {
          wb: acc.wb + wbQty,
          ozon: acc.ozon + ozonQty,
          total: acc.total + stock.total_quantity,
        };
      },
      { wb: 0, ozon: 0, total: 0 }
    );

    rows.push([]);
    rows.push(['ИТОГО', '', totals.wb, totals.ozon, totals.total, '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

  return ws;
}
