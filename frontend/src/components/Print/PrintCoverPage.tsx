/**
 * Обложка PDF — бренд, период, МП, дата генерации
 */
import { COLORS } from './print-constants';
import { formatDate } from '../../lib/utils';

interface PrintCoverPageProps {
  dateFrom: string;
  dateTo: string;
  marketplace: 'all' | 'ozon' | 'wb';
}

export function PrintCoverPage({ dateFrom, dateTo, marketplace }: PrintCoverPageProps) {
  const mpLabel =
    marketplace === 'all'
      ? 'OZON + Wildberries'
      : marketplace === 'ozon'
        ? 'OZON'
        : 'Wildberries';

  const now = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[700px] p-8 page-break-after overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)' }} />

      {/* Decorative circles */}
      <svg className="absolute top-0 right-0 w-80 h-80 opacity-[0.07]" viewBox="0 0 300 300">
        <circle cx="250" cy="50" r="200" fill={COLORS.indigo} />
      </svg>
      <svg className="absolute bottom-0 left-0 w-64 h-64 opacity-[0.05]" viewBox="0 0 250 250">
        <circle cx="50" cy="200" r="180" fill={COLORS.emerald} />
      </svg>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl">
        {/* Logo line */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLORS.indigo }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight" style={{ color: COLORS.gray900 }}>
            REVIOMP
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: COLORS.gray900 }}>
          Аналитический отчёт
        </h1>

        {/* Period */}
        <div className="text-xl font-medium mb-6" style={{ color: COLORS.gray500 }}>
          {formatDate(dateFrom)} — {formatDate(dateTo)}
        </div>

        {/* Marketplace badges */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {(marketplace === 'all' || marketplace === 'ozon') && (
            <div
              className="px-5 py-2 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: COLORS.ozon }}
            >
              OZON
            </div>
          )}
          {(marketplace === 'all' || marketplace === 'wb') && (
            <div
              className="px-5 py-2 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: COLORS.wb }}
            >
              Wildberries
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-24 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: COLORS.indigo, opacity: 0.3 }} />

        {/* Meta */}
        <div className="text-sm" style={{ color: COLORS.gray400 }}>
          {mpLabel} • Сгенерировано {now}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-xs" style={{ color: COLORS.gray400 }}>
        reviomp.ru — аналитика маркетплейсов
      </div>
    </div>
  );
}
