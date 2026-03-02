/**
 * Landing page navigation bar.
 * Sticky, backdrop-blur on scroll (rule #46: classList.toggle, NOT useState).
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '../constants/landingData';

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let prev = false;
    const onScroll = () => {
      const now = window.scrollY > 0;
      if (now !== prev) {
        prev = now;
        const h = headerRef.current;
        if (!h) return;
        h.classList.toggle('border-b', now);
        h.classList.toggle('border-gray-200/60', now);
        h.classList.toggle('bg-white/80', now);
        h.classList.toggle('backdrop-blur-xl', now);
        h.classList.toggle('bg-white', !now);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <header ref={headerRef} className="bg-white sticky top-0 z-50 transition-[background-color,backdrop-filter] duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - clickable, scrolls to top */}
          <button onClick={scrollToTop} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <BarChart3 className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Revio<span className="text-indigo-600">MP</span>
            </span>
          </button>

          {/* Desktop nav - clean gaps, no cell borders */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
            >
              Войти
            </Link>
            <Link
              to="/login?signup=1"
              className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-5 py-2 rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              Начать бесплатно
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Меню"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-4 space-y-1 animate-fade-in">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <hr className="border-gray-100 my-2" />
          <Link to="/login" className="text-sm text-gray-600 py-2.5 px-3 min-h-[44px] flex items-center hover:text-gray-900">
            Войти
          </Link>
          <Link
            to="/login?signup=1"
            className="flex items-center justify-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 rounded-xl transition-colors"
          >
            Начать бесплатно
          </Link>
        </div>
      )}
    </header>
  );
}
