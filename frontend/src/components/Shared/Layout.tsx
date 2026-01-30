/**
 * Layout с адаптивной навигацией
 * Desktop: header + горизонтальное меню (без изменений)
 * Mobile: верхнего меню нет; фиксированная плашка справа — язычок с переливанием,
 * по тапу выезжает панель с 4 ссылками влево
 */
import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { BarChart3, Package, TrendingUp, RefreshCw, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';

const navigation = [
  { name: 'Дашборд', href: '/', icon: BarChart3 },
  { name: 'Unit-экономика', href: '/unit-economics', icon: TrendingUp },
  { name: 'Реклама', href: '/ads', icon: Package },
  { name: 'Синхронизация', href: '/sync', icon: RefreshCw },
];

export const Layout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    setMobilePanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobilePanelOpen(false);
    };
    if (mobilePanelOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [mobilePanelOpen]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header только на десктопе; на мобиле — только боковая плашка */}
      {!isMobile && (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center flex-shrink-0">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
              <span className="ml-3 font-bold text-xl text-gray-900">
                Analytics
              </span>
            </Link>

            <nav className="flex space-x-1 ml-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

            <div className="w-8" />
          </div>
        </div>
      </header>
      )}

      {/* Mobile: верхнего меню нет; плашка справа + выезжающая панель */}
      {isMobile && (
        <>
          {/* Overlay: затемнение при открытой панели */}
          {mobilePanelOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
              onClick={() => setMobilePanelOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Язычок: фиксированная плашка справа, переливание + тап */}
          <div
            className="fixed right-0 top-[25%] z-50 -translate-y-1/2 flex items-center"
            style={{ touchAction: 'manipulation' }}
          >
            <button
              type="button"
              onClick={() => setMobilePanelOpen((v) => !v)}
              className="nav-tab-trigger relative flex h-20 w-10 flex-shrink-0 items-center justify-end rounded-l-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={mobilePanelOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobilePanelOpen}
            >
              <span
                className="nav-tab-strip absolute right-0 top-1/2 h-16 w-3 -translate-y-1/2"
                aria-hidden
              />
            </button>
          </div>

          {/* Панель: выезд влево, сразу 4 ссылки */}
          <div
            className={cn(
              'fixed top-0 right-0 z-50 h-full w-[min(280px,85vw)] bg-white shadow-2xl transition-transform duration-300 ease-out',
              mobilePanelOpen ? 'translate-x-0' : 'translate-x-full'
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация"
          >
            <div className="flex h-full flex-col border-l border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-indigo-600" />
                  <span className="font-semibold text-gray-900">Меню</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(false)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200"
                  aria-label="Закрыть"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <ul className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          onClick={() => setMobilePanelOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors',
                            isActive
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>
        </>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  );
};
