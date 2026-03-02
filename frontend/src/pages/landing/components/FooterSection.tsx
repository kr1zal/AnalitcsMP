/**
 * Footer section with navigation, support, legal links, and back-to-top button.
 */
import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Mail,
  Send,
  ExternalLink,
  ArrowUp,
  Zap,
} from 'lucide-react';
import { FOOTER_NAV, FOOTER_RESOURCES } from '../constants/landingData';

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function FooterLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="group relative text-sm text-gray-400 hover:text-white transition-colors duration-200"
      >
        {children}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
      </button>
    </li>
  );
}

function StatusBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-xs font-medium text-emerald-400">Все системы работают</span>
    </div>
  );
}

function MarketplaceBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-gray-400">
      <Zap className="w-3 h-3 text-indigo-400" />
      {name}
    </span>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Наверх"
      className={`group fixed bottom-6 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-xl bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 shadow-lg transition-all duration-300 hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-indigo-500/20 hover:shadow-xl ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
    >
      <ArrowUp className="w-4 h-4 text-gray-400 transition-colors group-hover:text-white" />
    </button>
  );
}

/* ──────────────────────────────────────────────
   FooterSection
   ────────────────────────────────────────────── */

export function FooterSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <BackToTop />
      <footer className="relative bg-gray-950" role="contentinfo">
        {/* Animated gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-pulse opacity-60" />

        {/* Subtle radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-40 bg-indigo-600/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          {/* Upper area: Logo + Tagline + Status */}
          <div className="pt-14 sm:pt-16 pb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white tracking-tight">RevioMP</span>
                <p className="text-sm text-gray-500 mt-0.5">Аналитика маркетплейсов WB и Ozon</p>
              </div>
            </div>
            <StatusBadge />
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

          {/* Main columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-10 py-10 sm:py-12">
            {/* Col 1: Navigation */}
            <div>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Навигация</h3>
              <ul className="space-y-3">
                {FOOTER_NAV.map((item) => (
                  <FooterLink key={item.id} onClick={() => scrollTo(item.id)}>
                    {item.label}
                  </FooterLink>
                ))}
              </ul>
            </div>

            {/* Col 2: Resources */}
            <div>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Ресурсы</h3>
              <ul className="space-y-3">
                {FOOTER_RESOURCES.map((item) => (
                  <FooterLink key={item.id} onClick={() => scrollTo(item.id)}>
                    {item.label}
                  </FooterLink>
                ))}
              </ul>
            </div>

            {/* Col 3: Support */}
            <div>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Поддержка</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="mailto:support@reviomp.ru"
                    className="group relative inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    <Mail className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                    support@reviomp.ru
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/RevioMPBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    <Send className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                    Telegram
                    <ExternalLink className="w-3 h-3 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0" />
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
                  </a>
                </li>
              </ul>

              {/* Social icons */}
              <div className="flex items-center gap-2 mt-5">
                <a
                  href="https://t.me/RevioMPBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all duration-200"
                >
                  <Send className="w-4 h-4" />
                </a>
                <a
                  href="mailto:support@reviomp.ru"
                  aria-label="Email"
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all duration-200"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Col 4: Legal */}
            <div>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Документы</h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/legal"
                    className="group relative text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Пользовательское соглашение
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/policy"
                    className="group relative text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Оплата и возврат
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="group relative text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Политика конфиденциальности
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300 group-hover:w-full" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

          {/* Bottom bar */}
          <div className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-500">
                  &copy; {new Date().getFullYear()} RevioMP
                </span>
              </div>
              <span className="hidden sm:inline text-gray-700">|</span>
              <div className="hidden sm:flex items-center gap-2">
                <MarketplaceBadge name="Wildberries" />
                <MarketplaceBadge name="Ozon" />
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Сделано для селлеров, которые считают каждый рубль
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
