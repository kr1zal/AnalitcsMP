/**
 * Обёртка каждой страницы PDF: padding, flex layout, footer, page-break
 */
import { cn } from '../../lib/utils';

interface PrintPageShellProps {
  children: React.ReactNode;
  page: number;
  totalPages: number;
  isLast?: boolean;
  noPadding?: boolean;
}

export function PrintPageShell({ children, page, totalPages, isLast = false, noPadding }: PrintPageShellProps) {
  return (
    <div className={cn('relative flex flex-col min-h-[700px]', !noPadding && 'p-8', !isLast && 'page-break-after')}>
      <div className="flex-1">{children}</div>
      <PrintFooter page={page} total={totalPages} />
    </div>
  );
}

function PrintFooter({ page, total }: { page: number; total: number }) {
  const now = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <footer className="mt-6 pt-3 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-400">
      <span>Сгенерировано: {now}</span>
      <span className="font-medium text-gray-500">reviomp.ru</span>
      <span>
        {page} / {total}
      </span>
    </footer>
  );
}
