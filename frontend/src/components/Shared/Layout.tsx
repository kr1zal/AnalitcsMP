/**
 * Layout с адаптивной навигацией
 * Desktop: header + горизонтальное меню
 * Mobile: компактная плашка справа с chevron, swipe для закрытия
 */
import { useState, useEffect, useRef, useCallback } from 'react';
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

// Минимальное расстояние свайпа для закрытия (px)
const SWIPE_THRESHOLD = 60;

export const Layout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // Swipe state
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);

  // Закрытие при смене маршрута
  useEffect(() => {
    setMobilePanelOpen(false);
    setSwipeOffset(0);
  }, [location.pathname]);

  // ESC и блокировка скролла
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobilePanelOpen(false);
        setSwipeOffset(0);
      }
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

  // Touch handlers для swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Только свайп вправо (закрытие)
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const diff = touchCurrentX.current - touchStartX.current;

    if (diff > SWIPE_THRESHOLD) {
      // Закрываем панель
      setMobilePanelOpen(false);
    }
    setSwipeOffset(0);
  }, []);

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

          {/* Язычок: 48px touch target, 16px полоска, chevron внутри */}
          <div
            className="fixed right-0 top-[25%] z-50 -translate-y-1/2 flex items-center"
            style={{ touchAction: 'manipulation' }}
          >
            <button
              type="button"
              onClick={() => setMobilePanelOpen((v) => !v)}
              className="nav-tab-trigger relative flex h-20 w-12 flex-shrink-0 items-center justify-end rounded-l-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={mobilePanelOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobilePanelOpen}
            >
              <span
                className="nav-tab-strip absolute right-0 top-1/2 h-20 -translate-y-1/2 flex items-center justify-center"
                aria-hidden
              >
                <ChevronLeft className="w-3 h-3 text-white/80" />
              </span>
            </button>
          </div>

          {/* Панель: swipe для закрытия, компактная */}
          <div
            className={cn(
              'fixed top-0 right-0 z-50 h-full w-[min(240px,75vw)] bg-white shadow-2xl transition-transform duration-300 ease-out',
              mobilePanelOpen ? 'translate-x-0' : 'translate-x-full'
            )}
            style={{
              transform: mobilePanelOpen
                ? `translateX(${swipeOffset}px)`
                : 'translateX(100%)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex h-full flex-col border-l border-gray-100">
              {/* Компактный header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-sm text-gray-900">Меню</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(false)}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200"
                  aria-label="Закрыть"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              {/* Компактная навигация */}
              <nav className="flex-1 overflow-y-auto px-2 py-2">
                <ul className="space-y-0.5">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          onClick={() => setMobilePanelOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              {/* Подсказка о свайпе */}
              <div className="px-3 py-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center">← свайп для закрытия</p>
              </div>
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
