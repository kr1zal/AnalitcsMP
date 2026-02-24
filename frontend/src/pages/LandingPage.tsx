/**
 * Landing page for unauthenticated users.
 * Rich visual design with Swiper carousel, scroll-reveal animations,
 * animated counters, Inter font, gradient accents.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  PieChart,
  ClipboardList,
  Megaphone,
  ChevronDown,
  CheckCircle,
  XCircle,
  ArrowRight,
  Menu,
  X,
  Lock,
  Eye,
  LineChart,
  Database,
  Globe,
  Monitor,
  Smartphone,
  Send,
  Mail,
  ArrowUp,
  Zap,
  ExternalLink,
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Hooks & helpers
   ────────────────────────────────────────────── */

/** IntersectionObserver-based reveal hook */
function useRevealOnScroll(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Elements already in viewport on load - reveal immediately, no animation
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('revealed', 'no-transition');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}

/** Wrapper that fades-up on scroll */
function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Animated counter that counts up when visible */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {value.toLocaleString('ru-RU')}
      {suffix}
    </span>
  );
}

/** Thin divider line between sections (Stripe-style, edge-to-edge of container) */
function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="h-px bg-gray-200" />
    </div>
  );
}

/* MatrixRain removed (24.02.2026) - irrelevant 2000s decoration, no enterprise sites use it */

/** Hook for spotlight card mouse tracking */
function useSpotlight() {
  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  }, []);
  return onMouseMove;
}

/* ──────────────────────────────────────────────
   NAVBAR
   ────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: 'Возможности', id: 'features' },
  { label: 'Тарифы', id: 'pricing' },
  { label: 'Безопасность', id: 'security' },
  { label: 'FAQ', id: 'faq' },
] as const;

function NavBar() {
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

/* ──────────────────────────────────────────────
   HERO
   ────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative pt-6 pb-16 sm:pt-8 sm:pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white" />

      {/* MatrixRain removed (24.02.2026) - irrelevant decoration, 2000s aesthetic */}

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full mb-10 sm:mb-14">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-indigo-700">
            WB + Ozon в одном дашборде
          </span>
        </div>

        {/* H1 */}
        <h1 className="animate-fade-up delay-100 text-[44px] sm:text-[64px] lg:text-[76px] font-extrabold leading-[1.08] tracking-tight max-w-4xl mx-auto">
          <span className="text-gray-900">Прозрачная аналитика</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            для маркетплейсов
          </span>
        </h1>

        {/* Subheadline - 2 lines max on desktop */}
        <p className="animate-fade-up delay-200 mt-5 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Выручка, прибыль, удержания, реклама и&nbsp;остатки - в&nbsp;реальном времени.
          Собери свой дашборд из&nbsp;виджетов за&nbsp;5 минут.
        </p>

        {/* CTA + trust inline */}
        <div className="animate-fade-up delay-300 mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login?signup=1"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50"
          >
            Начать бесплатно
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <span className="text-sm text-gray-400">
            Бесплатно навсегда. Без привязки карты.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   TRUST BAR (API protocols / data sources)
   ────────────────────────────────────────────── */

function TrustBar() {
  const renderSet = (prefix: string) => (
    <>
      <div key={`${prefix}-wb`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <span className="text-base font-black text-purple-500 tracking-tight select-none">WB</span>
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Wildberries API</span>
      </div>
      <div key={`${prefix}-oz`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <span className="text-base font-black text-blue-500 tracking-tight select-none">OZON</span>
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Ozon Seller API</span>
      </div>
      <div key={`${prefix}-pg`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Database className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Данные зашифрованы</span>
      </div>
      <div key={`${prefix}-rest`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Только чтение данных</span>
      </div>
      <div key={`${prefix}-ssl`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <ShieldCheck className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Безопасное соединение</span>
      </div>
      <div key={`${prefix}-fernet`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Ваши ключи защищены</span>
      </div>
    </>
  );

  return (
    <div className="border-t border-b border-gray-200 py-5 overflow-hidden">
      <div className="trust-marquee">
        <div className="trust-marquee-track">
          {renderSet('a')}
          {renderSet('b')}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   PRODUCT SHOWCASE - Enterprise Tab Slider
   ────────────────────────────────────────────── */

interface ShowcaseSlideData {
  id: string;
  tab: string;
  icon: typeof BarChart3;
  title: string;
  description: string;
  highlights: string[];
  desktop: string;
  mobile: string;
}

const SHOWCASE_SLIDES: ShowcaseSlideData[] = [
  {
    id: 'widgets',
    tab: 'Виджеты',
    icon: BarChart3,
    title: 'Дашборд, который подстраивается под вас',
    description: 'Drag\u00A0&\u00A0drop виджеты - выберите нужные метрики и\u00A0расставьте как удобно',
    highlights: ['16+ виджетов', 'WB + Ozon в\u00A0одном окне', 'Обновление каждые 30\u00A0мин'],
    desktop: '/screenshots/desktop-1.png',
    mobile: '/screenshots/mobile-3.png',
  },
  {
    id: 'unit-economics',
    tab: 'Юнит-экономика',
    icon: TrendingUp,
    title: 'Прибыль по каждому товару - до копейки',
    description: 'Себестоимость, маржа и\u00A0ДРР\u00A0- точная картина по\u00A0каждому SKU',
    highlights: ['Разбивка FBO\u00A0/\u00A0FBS', 'Водопад затрат', 'Отдельно по\u00A0маркетплейсам'],
    desktop: '/screenshots/desktop-2.png',
    mobile: '/screenshots/mobile-1.png',
  },
  {
    id: 'stocks',
    tab: 'Остатки',
    icon: ClipboardList,
    title: 'Запасы под контролем - без\u00A0OOS',
    description: 'Прогноз остатков, алерты при\u00A0нуле, все склады WB и\u00A0Ozon в\u00A0одной таблице',
    highlights: ['Прогноз на 30\u00A0дней', 'Алерты при\u00A00\u00A0остатков', 'Все склады WB\u00A0+\u00A0Ozon'],
    desktop: '/screenshots/desktop-3.png',
    mobile: '/screenshots/mobile-2.png',
  },
];

const SHOWCASE_AUTOPLAY_MS = 6000;

/** macOS-style browser chrome frame */
function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.12)] ring-1 ring-gray-900/[0.07] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-200/60" aria-hidden="true">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 ml-3 max-w-[260px] mx-auto">
          <div className="flex items-center gap-2 bg-white/80 rounded-lg px-3 py-1 border border-gray-200/60">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span className="text-[11px] text-gray-500 font-medium tracking-wide">reviomp.ru</span>
          </div>
        </div>
      </div>
      <div className="relative">
        {children}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/60 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

/** iPhone-style phone mockup frame */
function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div className="bg-gray-950 rounded-[2.5rem] p-2 shadow-2xl shadow-gray-900/20 ring-1 ring-gray-700/50">
      <div className="overflow-hidden rounded-[2.1rem] bg-white relative">
        {/* Dynamic Island */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-gray-950 rounded-full z-10" />
        <div className="relative">
          {children}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/70 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function ProductShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  const slide = SHOWCASE_SLIDES[activeIndex];

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setActiveIndex(i => (i + 1) % SHOWCASE_SLIDES.length);
      setProgressKey(k => k + 1);
    }, SHOWCASE_AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [activeIndex, paused]);

  const goTo = useCallback((idx: number) => {
    setActiveIndex(idx);
    setProgressKey(k => k + 1);
  }, []);

  // Keyboard navigation for tabs (WAI-ARIA Tabs Pattern)
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % SHOWCASE_SLIDES.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SHOWCASE_SLIDES.length - 1;
    else return;
    e.preventDefault();
    goTo(next);
    // Focus the new tab
    const tablist = (e.target as HTMLElement).parentElement;
    const buttons = tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }, [goTo]);

  return (
    <RevealSection className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header - enterprise */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.12em] bg-indigo-50 px-3.5 py-1.5 rounded-full mb-5" aria-hidden="true">
            Ключевые экраны
          </span>
          <h2 className="text-[28px] sm:text-4xl lg:text-[46px] font-extrabold text-gray-900 leading-[1.15] tracking-tight">
            Вся аналитика -{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              в&nbsp;трёх экранах
            </span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Дашборд, юнит-экономика и&nbsp;остатки - всё для&nbsp;принятия решений
          </p>
        </div>

        {/* Tab navigation - enhanced active state + progress + full ARIA */}
        <div
          className="flex justify-center gap-1.5 sm:gap-2 mb-10 sm:mb-12"
          role="tablist"
          aria-label="Экраны продукта"
        >
          {SHOWCASE_SLIDES.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === activeIndex;
            return (
              <button
                key={s.id}
                role="tab"
                id={`showcase-tab-${s.id}`}
                aria-selected={isActive}
                aria-controls={`showcase-panel-${s.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => goTo(i)}
                onKeyDown={e => handleTabKeyDown(e, i)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className={`
                  relative flex items-center gap-2 px-4 sm:px-6 min-h-[44px] rounded-xl text-sm font-medium
                  transition-all duration-300 overflow-hidden select-none
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                  ${isActive
                    ? 'bg-white text-gray-900 shadow-lg shadow-indigo-500/[0.08] ring-1 ring-gray-900/[0.08]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/80'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-colors duration-300 ${isActive ? 'text-indigo-600' : ''}`} />
                <span className="hidden sm:inline">{s.tab}</span>
                {isActive && !paused && (
                  <span
                    key={progressKey}
                    className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full showcase-tab-progress"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Screenshot showcase - tabpanel */}
        <div
          id={`showcase-panel-${slide.id}`}
          role="tabpanel"
          aria-labelledby={`showcase-tab-${slide.id}`}
          className="relative overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Background glow - decorative */}
          <div className="absolute -inset-4 sm:-inset-12 bg-gradient-to-b from-indigo-50/50 via-violet-50/20 to-transparent rounded-[2rem] pointer-events-none" aria-hidden="true" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[400px] rounded-full bg-indigo-100/30 blur-[80px] pointer-events-none" aria-hidden="true" />

          {device === 'desktop' ? (
            <div className="relative mx-auto max-w-5xl transition-all duration-500 ease-in-out">
              <BrowserFrame>
                <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
                  {SHOWCASE_SLIDES.map((s, i) => (
                    <img
                      key={s.id}
                      src={s.desktop}
                      alt={s.title}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-500 ease-in-out ${
                        i === activeIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
                      }`}
                    />
                  ))}
                </div>
              </BrowserFrame>
            </div>
          ) : (
            <div className="relative flex justify-center py-8">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-100/60 to-violet-100/40 blur-3xl pointer-events-none" />
              <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] rounded-full bg-gradient-to-br from-emerald-100/40 to-cyan-100/30 blur-2xl pointer-events-none" />
              <div className="relative w-[300px] sm:w-[340px] md:w-[380px]">
                <PhoneMockup>
                  <div className="relative overflow-hidden" style={{ aspectRatio: '9/18' }}>
                    {SHOWCASE_SLIDES.map((s, i) => (
                      <img
                        key={s.id}
                        src={s.mobile}
                        alt={s.title}
                        loading="lazy"
                        decoding="async"
                        className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-500 ease-in-out ${
                          i === activeIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
                        }`}
                      />
                    ))}
                  </div>
                </PhoneMockup>
              </div>
            </div>
          )}
        </div>

        {/* Feature details + device toggle + CTA */}
        <div className="mt-10 sm:mt-12 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            {/* Left: slide info */}
            <div className="text-center sm:text-left min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{slide.title}</h3>
              <p className="mt-1.5 text-sm sm:text-[15px] text-gray-500 leading-relaxed">{slide.description}</p>
            </div>

            {/* Right: device toggle */}
            <div className="flex items-center gap-3 shrink-0 self-center sm:self-auto">
              <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5" role="group" aria-label="Устройство просмотра">
                <button
                  onClick={() => setDevice('desktop')}
                  className={`flex items-center gap-1.5 px-3 min-h-[36px] rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    device === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label="Десктоп"
                  aria-pressed={device === 'desktop'}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
                <button
                  onClick={() => setDevice('mobile')}
                  className={`flex items-center gap-1.5 px-3 min-h-[36px] rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    device === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label="Мобильный"
                  aria-pressed={device === 'mobile'}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mobile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Highlights + CTA row */}
          <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {slide.highlights.map(h => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50/80 px-3 py-1.5 rounded-full ring-1 ring-gray-900/[0.06]"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {h}
                </span>
              ))}
            </div>
            <Link
              to="/login?signup=1"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md"
            >
              Попробовать бесплатно
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </RevealSection>
  );
}

/* ──────────────────────────────────────────────
   SOCIAL PROOF - Enterprise Testimonials Marquee
   ────────────────────────────────────────────── */

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  niche: string;
  marketplace: 'WB' | 'Ozon' | 'WB + Ozon';
  metric: string;
  metricLabel: string;
  initials: string;
  avatarColor: string;
}

const TESTIMONIALS_ROW_1: Testimonial[] = [
  {
    quote: 'Раньше каждый понедельник убивал полдня на Excel - сводил выручку, вычитал комиссии, пытался понять прибыль. Подключил сервис - и через 10 минут увидел цифру, которая совпала с моим расчётом. Только без четырёх часов работы.',
    author: 'Алексей М.',
    role: 'Продавец витаминов',
    niche: 'Витамины и БАДы',
    marketplace: 'WB',
    metric: '–4 часа',
    metricLabel: 'экономия в неделю',
    initials: 'АМ',
    avatarColor: 'bg-indigo-500',
  },
  {
    quote: 'У меня 12 SKU на Ozon, и я искренне не понимала, почему при хорошей выручке на счёт приходит копейки. Дерево удержаний показало: 23% уходило на логистику FBO. Перенесла часть на FBS - маржа выросла на 8 процентных пунктов.',
    author: 'Екатерина С.',
    role: 'Селлер БАДов',
    niche: 'БАДы',
    marketplace: 'Ozon',
    metric: '+8 п.п.',
    metricLabel: 'рост маржи',
    initials: 'ЕС',
    avatarColor: 'bg-blue-500',
  },
  {
    quote: 'Торгую одновременно на WB и Ozon. Открывать два личных кабинета, выгружать отчёты, сводить в таблице - это был ад. Здесь оба маркетплейса в одном экране, и я вижу, где какой товар приносит больше. Решения принимаю за минуты.',
    author: 'Дмитрий К.',
    role: 'Селлер спортпита',
    niche: 'Спортивное питание',
    marketplace: 'WB + Ozon',
    metric: '2 МП',
    metricLabel: 'в одном дашборде',
    initials: 'ДК',
    avatarColor: 'bg-emerald-500',
  },
  {
    quote: 'Юнит-экономика спасла мой бизнес. Я думала, что все 8 позиций прибыльные. Оказалось, два SKU работали в минус из-за высокой комиссии и возвратов. Убрала их - общая прибыль выросла, хотя выручка снизилась.',
    author: 'Марина Л.',
    role: 'Продавец косметики',
    niche: 'Косметика',
    marketplace: 'WB',
    metric: '2 SKU',
    metricLabel: 'убыточных найдено',
    initials: 'МЛ',
    avatarColor: 'bg-rose-500',
  },
];

const TESTIMONIALS_ROW_2: Testimonial[] = [
  {
    quote: 'Дважды попадал на OOS - товар кончился, карточка улетела вниз, потом две недели восстанавливал позиции. С прогнозом остатков вижу, когда нужно заказывать поставку. Уже два месяца без единого out-of-stock.',
    author: 'Сергей В.',
    role: 'Продавец БАДов',
    niche: 'БАДы',
    marketplace: 'Ozon',
    metric: '0 OOS',
    metricLabel: 'за 2 месяца',
    initials: 'СВ',
    avatarColor: 'bg-amber-500',
  },
  {
    quote: 'Лила деньги в рекламу на WB и не понимала, окупается она или нет. В аналитике увидела ДРР 18% - при марже 22% это почти ноль прибыли. Перераспределила бюджет на топовые карточки, ДРР упал до 9%.',
    author: 'Анна Т.',
    role: 'Категорийный менеджер',
    niche: 'Витамины',
    marketplace: 'WB',
    metric: '9%',
    metricLabel: 'ДРР вместо 18%',
    initials: 'АТ',
    avatarColor: 'bg-violet-500',
  },
  {
    quote: 'Ставил план продаж наобум - просто \"хочу миллион\". Теперь вижу реальный темп: сколько продаю в день, укладываюсь или нет, прогноз на конец месяца. В январе впервые выполнил план на 94%. Просто потому что видел, где отстаю.',
    author: 'Игорь Н.',
    role: 'Предприниматель',
    niche: 'БАДы и витамины',
    marketplace: 'WB + Ozon',
    metric: '94%',
    metricLabel: 'выполнение плана',
    initials: 'ИН',
    avatarColor: 'bg-cyan-500',
  },
  {
    quote: 'Каждое утро данные уже обновлены. Не нужно ничего выгружать, импортировать, ждать. Открываю дашборд - и сразу вижу вчерашнюю прибыль, остатки, рекламу. Для меня это как иметь финдиректора, который работает 24/7.',
    author: 'Ольга П.',
    role: 'Владелец магазина',
    niche: 'Здоровое питание',
    marketplace: 'Ozon',
    metric: '24/7',
    metricLabel: 'автосинхронизация',
    initials: 'ОП',
    avatarColor: 'bg-teal-500',
  },
];

const MP_BADGE_STYLES: Record<string, string> = {
  'WB': 'bg-violet-50 text-violet-600 ring-violet-200',
  'Ozon': 'bg-blue-50 text-blue-600 ring-blue-200',
  'WB + Ozon': 'bg-indigo-50 text-indigo-600 ring-indigo-200',
};

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="w-[340px] sm:w-[380px] flex-shrink-0 mx-3">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Metric highlight */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
            <span className="text-lg font-bold text-gray-900">{t.metric}</span>
            <span className="text-xs text-gray-500">{t.metricLabel}</span>
          </div>
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ring-1 ring-inset ${MP_BADGE_STYLES[t.marketplace]}`}>
            {t.marketplace}
          </span>
        </div>

        {/* Quote */}
        <p className="text-[13px] sm:text-sm leading-relaxed text-gray-600 flex-1 mb-4">
          {t.quote}
        </p>

        {/* Author */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
          <div className={`w-9 h-9 rounded-full ${t.avatarColor} flex items-center justify-center`}>
            <span className="text-xs font-semibold text-white">{t.initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{t.author}</p>
            <p className="text-xs text-gray-400 truncate">{t.role} · {t.niche}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Touch-swipeable marquee row. CSS animation for auto-scroll, pointer events for manual drag. */
function MarqueeRow({ testimonials, direction }: { testimonials: Testimonial[]; direction: 'left' | 'right' }) {
  const doubled = [...testimonials, ...testimonials];
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const currentOffset = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ANIMATION_DURATION = 60; // seconds, must match CSS

  /** Read current translateX from the running CSS animation or inline transform */
  const getTranslateX = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const style = window.getComputedStyle(el);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m41;
  }, []);

  /** Pause CSS animation and switch to manual transform */
  const pauseAnimation = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const tx = getTranslateX();
    currentOffset.current = tx;
    el.style.animation = 'none';
    el.style.transform = `translateX(${tx}px)`;
  }, [getTranslateX]);

  /** Resume CSS animation from current offset position */
  const resumeAnimation = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const totalWidth = el.scrollWidth / 2; // half = one set of cards
    const tx = currentOffset.current;

    // Normalize offset into [0, -totalWidth) range for left, [-totalWidth, 0) for right
    let normalizedTx = tx % totalWidth;
    if (direction === 'left') {
      if (normalizedTx > 0) normalizedTx -= totalWidth;
    } else {
      if (normalizedTx < -totalWidth) normalizedTx += totalWidth;
    }
    currentOffset.current = normalizedTx;

    // Calculate what fraction of the animation cycle this offset represents
    const progress = direction === 'left'
      ? Math.abs(normalizedTx) / totalWidth
      : 1 - Math.abs(normalizedTx) / totalWidth;
    const delay = -(progress * ANIMATION_DURATION);

    el.style.transform = '';
    el.style.animation = '';
    el.classList.remove(direction === 'left' ? 'marquee-left' : 'marquee-right');

    // Force reflow to restart animation
    void el.offsetWidth;

    el.style.animationDelay = `${delay}s`;
    el.classList.add(direction === 'left' ? 'marquee-left' : 'marquee-right');
  }, [direction, ANIMATION_DURATION]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle touch (not mouse on desktop - desktop uses hover pause)
    if (e.pointerType === 'mouse') return;
    dragging.current = true;
    startX.current = e.clientX;
    clearTimeout(resumeTimer.current);
    pauseAnimation();
    startOffset.current = currentOffset.current;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pauseAnimation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || e.pointerType === 'mouse') return;
    const deltaX = e.clientX - startX.current;
    const tx = startOffset.current + deltaX;
    currentOffset.current = tx;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${tx}px)`;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || e.pointerType === 'mouse') return;
    dragging.current = false;
    // Resume auto-scroll after 2s pause
    resumeTimer.current = setTimeout(resumeAnimation, 2000);
  }, [resumeAnimation]);

  useEffect(() => {
    return () => clearTimeout(resumeTimer.current);
  }, []);

  return (
    <div className="overflow-hidden">
      <div
        ref={trackRef}
        className={`marquee-track ${direction === 'left' ? 'marquee-left' : 'marquee-right'}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={`${t.author}-${i}`} t={t} />
        ))}
      </div>
    </div>
  );
}

function SocialProofSection() {
  return (
    <section aria-label="Отзывы клиентов" className="py-14 sm:py-20 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-10 sm:mb-14">
        <RevealSection>
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-600 mb-2 tracking-wide uppercase">
              Отзывы продавцов
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Что говорят те, кто уже считает прибыль
            </h2>
            <p className="text-gray-500 text-sm sm:text-base max-w-2xl mx-auto">
              Селлеры витаминов, БАДов и косметики делятся результатами работы с RevioMP
            </p>
          </div>
        </RevealSection>
      </div>

      {/* Marquee rows */}
      <div className="space-y-4 sm:space-y-6 relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-gray-50 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-gray-50 to-transparent z-10" />

        <MarqueeRow testimonials={TESTIMONIALS_ROW_1} direction="left" />
        <MarqueeRow testimonials={TESTIMONIALS_ROW_2} direction="right" />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   STATS BAR
   ────────────────────────────────────────────── */

function StatsBar() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { value: 100, suffix: '%', label: 'Точность расчётов', extra: 'Проверено аудитом' },
              { value: 15, suffix: '+', label: 'Типов отчётов', extra: 'Продажи, остатки, реклама...' },
              { value: 4, suffix: '', label: 'Синхронизации в день', extra: 'Данные всегда актуальны' },
              { value: 5, suffix: '', label: 'Минут на настройку', extra: 'API-ключ и готово' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{stat.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{stat.extra}</p>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   PROBLEM SECTION
   ────────────────────────────────────────────── */

function ProblemSection() {
  const problems = [
    {
      icon: LineChart,
      title: 'Excel и ручные расчёты',
      description: 'Часы на сбор данных из разных ЛК. Формулы ломаются, данные теряются.',
      gradient: 'from-red-500 to-rose-600',
      bg: 'bg-red-50',
    },
    {
      icon: Eye,
      title: 'Скрытые удержания МП',
      description: 'Логистика, хранение, штрафы - разбросаны по десяткам отчётов. Реальную прибыль посчитать невозможно.',
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
    },
    {
      icon: RefreshCw,
      title: 'Потеря времени',
      description: 'Вместо развития бизнеса - бесконечная сверка цифр между маркетплейсами.',
      gradient: 'from-orange-500 to-red-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Знакомо?
          </h2>
          <p className="mt-3 text-gray-500 text-center max-w-lg mx-auto">
            Каждый продавец на маркетплейсах сталкивается с этим
          </p>
        </RevealSection>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {problems.map((p, i) => {
            const Icon = p.icon;
            return (
              <RevealSection key={p.title} delay={i * 100}>
                <div className={`${p.bg} border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow h-full`}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.description}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FEATURES
   ────────────────────────────────────────────── */

function FeaturesSection() {
  const spotlightMove = useSpotlight();
  const features = [
    {
      icon: BarChart3,
      title: 'Дашборд',
      description: 'Все ключевые метрики на одном экране: выручка, прибыль, возвраты, ДРР.',
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      icon: TrendingUp,
      title: 'Реальная прибыль',
      description: 'Автоматический расчёт чистой прибыли с учётом ВСЕХ удержаний маркетплейсов.',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: PieChart,
      title: 'Дерево удержаний',
      description: 'Детализация расходов: комиссии, логистика, хранение, штрафы - как в ЛК, но нагляднее.',
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      icon: ClipboardList,
      title: 'Монитор заказов',
      description: 'Позаказная детализация с реальными ценами после скидок и полной разбивкой издержек.',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: RefreshCw,
      title: 'Авто-синхронизация',
      description: 'Данные обновляются автоматически до 4 раз в день. Без ручных выгрузок.',
      gradient: 'from-cyan-500 to-cyan-600',
    },
    {
      icon: Megaphone,
      title: 'Рекламная аналитика',
      description: 'Расходы на рекламу, ДРР по дням, ROI кампаний - WB и Ozon в одном месте.',
      gradient: 'from-amber-500 to-amber-600',
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Всё, что нужно для аналитики
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Подключите API-токены маркетплейсов и получите полную картину бизнеса за минуту.
            </p>
          </div>
        </RevealSection>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <RevealSection key={f.title} delay={i * 80}>
                <div
                  onMouseMove={spotlightMove}
                  className="spotlight-card group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 h-full"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.description}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}



/* ──────────────────────────────────────────────
   DATAFLOW V4 - ENTERPRISE DATA PIPELINE
   5 sources, 6 data types, central hub,
   5 outputs, grouped integrations + exports.
   Static pills, smooth bezier curves, dot grid.
   ────────────────────────────────────────────── */

function DataFlowSectionV4() {
  const [triggered, setTriggered] = useState(false);
  const [alive, setAlive] = useState(false);
  const [tick, setTick] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  /* ── Pill flip refs: direct DOM manipulation for smooth scaleX (no React re-render per frame) ── */
  const pillRefD0 = useRef<SVGGElement>(null);
  const pillRefD1 = useRef<SVGGElement>(null);
  const pillRefD2 = useRef<SVGGElement>(null);
  const pillRefM0 = useRef<SVGGElement>(null);
  const pillRefM1 = useRef<SVGGElement>(null);
  const pillRefM2 = useRef<SVGGElement>(null);
  const pillRefsDesktop = [pillRefD0, pillRefD1, pillRefD2];
  const pillRefsMobile  = [pillRefM0, pillRefM1, pillRefM2];

  /* ── SPP sequence animation refs ── */
  const sppPillRefD = useRef<SVGGElement>(null);
  const sppLineRefD = useRef<SVGPathElement>(null);
  const sppDotRefD  = useRef<SVGCircleElement>(null);
  const sppPillRefM = useRef<SVGGElement>(null);
  const sppLineRefM = useRef<SVGPathElement>(null);
  const sppDotRefM  = useRef<SVGCircleElement>(null);
  const sppClipRectD = useRef<SVGRectElement>(null);
  const sppClipRectM = useRef<SVGRectElement>(null);
  /* label index per pill: 0=labelA, 1=labelB - mutated by RAF, read by render */
  const pillLabelIdxRef = useRef([0, 0, 0]);
  /* incremented to trigger React re-render exactly when text changes */
  const [_pillFlipTick, setPillFlipTick] = useState(0);

  /* ── Scroll trigger ── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTriggered(true); obs.unobserve(el); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Alive flag: micro-animations start after entrance completes ── */
  useEffect(() => {
    if (!triggered) return;
    const t = setTimeout(() => setAlive(true), 2500);
    return () => clearTimeout(t);
  }, [triggered]);

  /* ── Tick counter for cycling labels (Отчёт ↔ Презентация) ── */
  useEffect(() => {
    if (!alive) return;
    setTick(0);
    const t = setInterval(() => setTick(c => c + 1), 1000);
    return () => clearInterval(t);
  }, [alive]);

  const reportLabels = ['Отчёт', 'Презентация'] as const;
  const reportCycle = tick >= 0 ? Math.floor((tick + 1) / 5) : -1;
  const reportLabel = tick >= 0 ? reportLabels[reportCycle % 2] : reportLabels[0];

  /* ── Pill flip labels (pairs per pill) ── */
  const pillFlipLabels: [string, string][] = [
    ['Продажи', 'Заказы'],
    ['Остатки', 'Склады'],
    ['Реклама', 'Комиссии'],
  ];

  /* ── RAF pill flip: single source of truth for both scaleX and text change.
     Each pill has a staggered start delay (0 / 1.7s / 3.4s) so flips never overlap.
     scaleX is mutated directly on the DOM - zero React re-renders per frame.
     Text changes ONLY at the instant scaleX≈0 (phase 0.34–0.38), then React re-renders once. ── */
  useEffect(() => {
    if (!alive || prefersReducedMotion.current) return;

    const PERIOD    = 5000;          // full flip cycle, ms
    const DELAYS_MS = [0, 1700, 3400]; // stagger offsets per pill
    const FLIP_IN_LO  = 0.30;        // compress starts
    const FLIP_PEAK   = 0.36;        // scaleX = 0 here → text changes
    const FLIP_OUT_HI = 0.42;        // expand ends
    const WIN_LO      = 0.34;        // text-change gate open
    const WIN_HI      = 0.38;        // text-change gate close

    /* quadratic easing for snappy Stripe-style flip */
    const easeIn  = (t: number) => t * t;
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

    function getScale(phase: number): number {
      if (phase < FLIP_IN_LO)  return 1;
      if (phase <= FLIP_PEAK)  { const t = (phase - FLIP_IN_LO) / (FLIP_PEAK - FLIP_IN_LO);  return 1 - easeIn(t);  }
      if (phase <= FLIP_OUT_HI){ const t = (phase - FLIP_PEAK)  / (FLIP_OUT_HI - FLIP_PEAK); return easeOut(t); }
      return 1;
    }

    const start  = performance.now();
    const atZero = [false, false, false]; // debounce: fired this peak window?
    let raf: number;

    function frame(now: number) {
      const elapsed = now - start;
      let needsRender = false;

      for (let i = 0; i < 3; i++) {
        const t = elapsed - DELAYS_MS[i];
        if (t < 0) continue;

        const phase  = (t % PERIOD) / PERIOD;
        const scaleX = getScale(phase);
        const tf     = `scaleX(${scaleX.toFixed(4)})`;

        /* direct DOM mutation - bypasses React reconciler for smooth 60fps */
        if (pillRefsDesktop[i].current) pillRefsDesktop[i].current!.style.transform = tf;
        if (pillRefsMobile[i].current)  pillRefsMobile[i].current!.style.transform  = tf;

        /* text gate: change label EXACTLY when scaleX≈0, never while pill is visible */
        const inWindow = phase >= WIN_LO && phase < WIN_HI;
        if (inWindow && !atZero[i]) {
          atZero[i] = true;
          pillLabelIdxRef.current[i] = (pillLabelIdxRef.current[i] + 1) % 2;
          needsRender = true;
        } else if (!inWindow) {
          atZero[i] = false;
        }
      }

      if (needsRender) setPillFlipTick(v => v + 1); // triggers one render for text update

      // ── SPP cycle: pill in → line grows (pill→hub) → dot travels → line erases (hub→pill) → pill out → pause ──
      // CYCLE 7000ms:
      //   [0-600]     PILL fades in - no line yet
      //   [600-1800]  LINE extends A→B (pill→hub): dashed, directional clip reveal
      //   [1800-3200] STABLE: dot travels on full dashed line, pill visible
      //   [3200-4400] LINE erases B→A (hub→pill): dashed, directional clip erase
      //   [4400-5000] PILL fades out (line already gone)
      //   [5000-7000] 2s PAUSE - all invisible
      const SPP_CYCLE = 7000;
      const sppS = [0, 600, 1800, 3200, 4400, 5000, 7000] as const;
      const sppSs = (t: number) => t * t * (3 - 2 * t); // smoothstep

      const sppT = elapsed % SPP_CYCLE;

      let sppPillOp = 0;
      let sppDotOp  = 0;
      let sppDotP   = 0;
      // clip mode: 'none'=rect width 0, 'extend'=growing, 'erase'=shrinking, 'full'=max width
      let sppClipMode: 'none' | 'extend' | 'erase' | 'full' = 'none';
      let sppClipP = 0; // progress 0→1

      if (sppT < sppS[1]) {
        // 0-600ms: pill fades in
        sppPillOp = sppSs(sppT / sppS[1]);
        sppClipMode = 'none';
      } else if (sppT < sppS[2]) {
        // 600-1800ms: line extends pill→hub
        sppPillOp = 1;
        sppClipMode = 'extend';
        sppClipP = sppSs((sppT - sppS[1]) / (sppS[2] - sppS[1]));
      } else if (sppT < sppS[3]) {
        // 1800-3200ms: stable - dot travels
        sppPillOp = 1;
        sppClipMode = 'full';
        sppDotOp = 1;
        sppDotP = sppSs((sppT - sppS[2]) / (sppS[3] - sppS[2]));
      } else if (sppT < sppS[4]) {
        // 3200-4400ms: line erases hub→pill, dot fades quickly
        const p = (sppT - sppS[3]) / (sppS[4] - sppS[3]);
        sppPillOp = 1;
        sppClipMode = 'erase';
        sppClipP = sppSs(p);
        sppDotOp = Math.max(0, 1 - sppSs(Math.min(1, p * 2)));
        sppDotP = 1;
      } else if (sppT < sppS[5]) {
        // 4400-5000ms: pill fades out
        sppPillOp = 1 - sppSs((sppT - sppS[4]) / (sppS[5] - sppS[4]));
        sppClipMode = 'none';
      } else {
        // 5000-7000ms: pause
        sppPillOp = 0;
        sppClipMode = 'none';
      }

      // Helper: apply SPP state via clipRect + line opacity + dot position + pill opacity
      // pillAtLeft=true: pill is at LEFT side (desktop - pill x≈340, hub x≈440, grows left→right)
      // pillAtLeft=false: pill is at RIGHT side (mobile - pill x≈209, hub x≈160, grows right→left)
      const applySpp = (
        lineEl:     SVGPathElement | null,
        dotEl:      SVGCircleElement | null,
        pillEl:     SVGGElement | null,
        clipRectEl: SVGRectElement | null,
        clipX0:     number,   // leftmost x of bounding box (with 2px padding)
        clipW:      number,   // total width of bounding box
        pillAtLeft: boolean,  // growth direction
      ) => {
        if (!lineEl) return;

        // ── Clip rect: directional grow/erase ──
        if (clipRectEl) {
          if (sppClipMode === 'none') {
            clipRectEl.setAttribute('width', '0');
          } else if (sppClipMode === 'full') {
            clipRectEl.setAttribute('x', String(clipX0));
            clipRectEl.setAttribute('width', String(clipW));
          } else if (sppClipMode === 'extend') {
            const w = (sppClipP * clipW).toFixed(1);
            if (pillAtLeft) {
              // Desktop: grow leftward (pill) → rightward (hub)
              clipRectEl.setAttribute('x', String(clipX0));
            } else {
              // Mobile: grow rightward (pill) → leftward (hub)
              clipRectEl.setAttribute('x', (clipX0 + clipW - sppClipP * clipW).toFixed(1));
            }
            clipRectEl.setAttribute('width', w);
          } else { // 'erase'
            const w = ((1 - sppClipP) * clipW).toFixed(1);
            if (pillAtLeft) {
              // Desktop: shrink from right (hub disappears first, pill stays last)
              clipRectEl.setAttribute('x', String(clipX0));
            } else {
              // Mobile: shrink from left (hub disappears first)
              clipRectEl.setAttribute('x', (clipX0 + sppClipP * clipW).toFixed(1));
            }
            clipRectEl.setAttribute('width', w);
          }
        }

        // ── Line: always dashed, visibility via clip ──
        lineEl.style.strokeDasharray = '8 8';
        lineEl.style.strokeDashoffset = '0';
        lineEl.style.opacity = sppClipMode === 'none' ? '0' : '1';

        // ── Dot: position via getPointAtLength ──
        if (dotEl) {
          if (sppDotOp > 0) {
            const pLen = lineEl.getTotalLength();
            const pt = lineEl.getPointAtLength(sppDotP * pLen);
            dotEl.setAttribute('cx', pt.x.toFixed(1));
            dotEl.setAttribute('cy', pt.y.toFixed(1));
            dotEl.style.opacity = String(sppDotOp.toFixed(3));
          } else {
            dotEl.style.opacity = '0';
          }
        }

        if (pillEl) pillEl.style.opacity = String(sppPillOp.toFixed(3));
      };

      // Desktop: P.pill5ToHub = 'M340,336 C390,336 410,245 440,240'
      //   bbox x: 338–442 (w=104), y: 236–340 (h=104), pill at LEFT
      applySpp(
        sppLineRefD.current, sppDotRefD.current, sppPillRefD.current, sppClipRectD.current,
        338, 104, true,
      );
      // Mobile: PM.pill5ToHub = 'M209,144 C209,158 160,158 160,170'
      //   bbox x: 158–211 (w=53), y: 140–172 (h=32), pill at RIGHT
      applySpp(
        sppLineRefM.current, sppDotRefM.current, sppPillRefM.current, sppClipRectM.current,
        158, 53, false,
      );

      raf = requestAnimationFrame(frame); // ← continue loop
    }

    raf = requestAnimationFrame(frame); // ← start loop
    return () => cancelAnimationFrame(raf);
  }, [alive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* current label per pill - re-read from ref on each render (cheap) */
  const pillFlipCurrent = pillFlipLabels.map(([a, b], i) =>
    pillLabelIdxRef.current[i] % 2 === 0 ? a : b
  );

  /* ── Entrance helper (one-shot, staggered) ── */
  const show = (delay: number): React.CSSProperties => ({
    opacity: triggered ? 1 : 0,
    transform: triggered ? 'scale(1)' : 'scale(0.85)',
    transition: triggered
      ? `opacity 0.6s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.6s cubic-bezier(.4,0,.2,1) ${delay}s`
      : 'none',
  });

  /* ── Line draw-on helper (draws once as dashed from the start, no solid→dashed jump) ── */
  const draw = (delay: number, len: number, dashPat = '6 10') => ({
    strokeDasharray: dashPat,
    strokeDashoffset: triggered ? 0 : len * 3,
    style: {
      transition: triggered
        ? `stroke-dashoffset 1.2s cubic-bezier(.66,0,.34,1) ${delay}s`
        : 'none',
    } as React.CSSProperties,
  });

  /* ── Path definitions (V4 smooth cubic bezier) ── */
  const P = {
    // Sources -> Pills (WB→pill1,pill2; Ozon→pill3,pill4)
    wbToPill1:    'M165,78  C195,78  210,80  230,80',
    wbToPill2:    'M165,92  C195,92  210,144 230,144',
    ozonToPill3:  'M165,162 C195,162 210,208 230,208',
    ozonToPill4:  'M165,178 C200,178 210,272 230,272',
    // Pills -> Hub (5 pills: y-centers 80,144,208,272,336; endpoint x=440 = outer dashed border)
    pill1ToHub:    'M340,80  C390,80  410,185 440,190',
    pill2ToHub:    'M340,144 C385,144 410,200 440,205',
    pill3ToHub:    'M340,208 C380,208 410,215 440,215',
    pill4ToHub:    'M340,272 C385,272 410,230 440,225',
    pill5ToHub:    'M340,336 C390,336 410,245 440,240',
    // Hub -> Outputs
    hubToDash:     'M640,185 C670,185 680,74  710,74',
    hubToPnl:      'M640,195 C670,195 680,142 710,142',
    hubToStocks:   'M640,210 C670,210 680,210 710,210',
    hubToReport:   'M640,225 C670,225 680,278 710,278',
    hubToPlan:     'M640,235 C670,235 680,346 710,346',
    // Outputs -> Integrations
    dashToTelegram: 'M850,66  C875,66  895,76  920,76',
    dashToWebhook:  'M850,82  C875,82  895,124 920,124',
    pnlToApi:       'M850,142 C875,142 895,172 920,172',
    // Outputs -> Exports
    reportToExcel: 'M850,286 C875,286 895,294 920,294',
    reportToPdf:   'M850,286 C875,286 895,342 920,342',
  };

  /* ── Mobile path definitions ── */
  const PM = {
    wbToRow1:    'M83,52  C83,62  62,68  62,78',
    wbToRow1b:   'M83,52  C83,62  160,62 160,78',
    ozonToRow1:  'M237,52 C237,62 258,68 258,78',
    ozonToRow1b: 'M237,52 C237,62 160,62 160,78',
    // pill→hub endpoints y=170 = outer top border; hub→out y=242 = outer bottom border
    pill1ToHub:  'M62,106  C62,140 160,140 160,170',
    pill2ToHub:  'M160,106 L160,170',
    pill3ToHub:  'M258,106 C258,140 160,140 160,170',
    pill4ToHub:  'M111,144 C111,158 160,158 160,170',
    pill5ToHub:  'M209,144 C209,158 160,158 160,170',
    hubToOut1:   'M160,242 C160,256 62,256  62,275',
    hubToOut2:   'M160,242 C160,256 160,256 160,275',
    hubToOut3:   'M160,242 C160,256 258,256 258,275',
    hubToOut4:   'M160,242 C160,266 102,296 102,316',
    hubToOut5:   'M160,242 C160,266 218,296 218,316',
    out1ToBdg1:  'M62,305  L62,380',
    out2ToBdg2:  'M160,305 L160,380',
    out3ToBdg3:  'M258,305 L258,380',
    out4ToBdg4:  'M102,346 C102,362 111,370 111,414',
    out5ToBdg5:  'M218,346 C218,362 209,370 209,414',
  };

  /* ── Traveling data packet configs (desktop) ── */
  const packets = [
    // Sources -> Pills
    { path: P.wbToPill1,      c: '#8b5cf6', r: 3,   op: 0.6,  dur: '2s',   begin: '0s' },
    { path: P.wbToPill2,      c: '#8b5cf6', r: 2,   op: 0.4,  dur: '2.8s', begin: '1.4s' },
    { path: P.ozonToPill3,    c: '#3b82f6', r: 3,   op: 0.6,  dur: '2.5s', begin: '0.5s' },
    { path: P.ozonToPill4,    c: '#3b82f6', r: 2,   op: 0.4,  dur: '3s',   begin: '1.8s' },
    // Pills -> Hub
    { path: P.pill1ToHub,     c: '#6366f1', r: 2.5, op: 0.5,  dur: '2.5s', begin: '0.3s' },
    { path: P.pill2ToHub,     c: '#818cf8', r: 2,   op: 0.45, dur: '2.2s', begin: '1s' },
    { path: P.pill3ToHub,     c: '#818cf8', r: 2,   op: 0.45, dur: '2.8s', begin: '0.7s' },
    { path: P.pill4ToHub,     c: '#818cf8', r: 2,   op: 0.45, dur: '2.2s', begin: '1.5s' },
    // Hub -> Outputs
    { path: P.hubToDash,      c: '#6366f1', r: 2.5, op: 0.5,  dur: '2s',   begin: '0.3s' },
    { path: P.hubToPnl,       c: '#6366f1', r: 2.5, op: 0.5,  dur: '1.5s', begin: '0.8s' },
    { path: P.hubToStocks,    c: '#6366f1', r: 2,   op: 0.45, dur: '1.8s', begin: '1.3s' },
    { path: P.hubToReport,    c: '#6366f1', r: 2,   op: 0.45, dur: '2s',   begin: '0.6s' },
    { path: P.hubToPlan,      c: '#8b5cf6', r: 2,   op: 0.4,  dur: '2.3s', begin: '1.1s' },
    // Outputs -> Integrations
    { path: P.dashToTelegram,  c: '#38bdf8', r: 1.5, op: 0.5,  dur: '1.2s', begin: '0.2s' },
    { path: P.dashToWebhook,   c: '#34d399', r: 1.5, op: 0.5,  dur: '1.4s', begin: '0.9s' },
    { path: P.pnlToApi,        c: '#818cf8', r: 1.5, op: 0.45, dur: '1.3s', begin: '0.4s' },
  ];

  /* ── Mobile traveling packets ── */
  const mobilePackets = [
    // Sources -> Pills
    { path: PM.wbToRow1,    c: '#8b5cf6', r: 2,   op: 0.6,  dur: '1.8s', begin: '0s' },
    { path: PM.wbToRow1b,   c: '#8b5cf6', r: 1.5, op: 0.35, dur: '2.2s', begin: '1.1s' },
    { path: PM.ozonToRow1,  c: '#3b82f6', r: 2,   op: 0.6,  dur: '1.8s', begin: '0.3s' },
    { path: PM.ozonToRow1b, c: '#3b82f6', r: 1.5, op: 0.35, dur: '2.2s', begin: '1.4s' },
    // Pills -> Hub
    { path: PM.pill1ToHub,  c: '#6366f1', r: 1.5, op: 0.5,  dur: '1.5s', begin: '0.2s' },
    { path: PM.pill2ToHub,  c: '#6366f1', r: 1.5, op: 0.5,  dur: '1.2s', begin: '0.6s' },
    { path: PM.pill3ToHub,  c: '#6366f1', r: 1.5, op: 0.5,  dur: '1.5s', begin: '0.9s' },
    { path: PM.pill4ToHub,  c: '#818cf8', r: 1.5, op: 0.4,  dur: '1.3s', begin: '0.4s' },
    // Hub -> Outputs
    { path: PM.hubToOut1,   c: '#6366f1', r: 1.5, op: 0.5,  dur: '2s',   begin: '0.1s' },
    { path: PM.hubToOut2,   c: '#6366f1', r: 1.5, op: 0.45, dur: '1s',   begin: '0.5s' },
    { path: PM.hubToOut3,   c: '#6366f1', r: 1.5, op: 0.5,  dur: '2s',   begin: '0.9s' },
    { path: PM.hubToOut4,   c: '#8b5cf6', r: 1.5, op: 0.4,  dur: '1.4s', begin: '0.7s' },
    { path: PM.hubToOut5,   c: '#8b5cf6', r: 1.5, op: 0.4,  dur: '1.6s', begin: '1.2s' },
    // Outputs -> Badges
    { path: PM.out1ToBdg1,  c: '#38bdf8', r: 1.5, op: 0.5,  dur: '1.2s', begin: '0.3s' },
    { path: PM.out2ToBdg2,  c: '#34d399', r: 1.5, op: 0.5,  dur: '1s',   begin: '0.8s' },
    { path: PM.out3ToBdg3,  c: '#818cf8', r: 1.5, op: 0.45, dur: '1.3s', begin: '0.5s' },
  ];

  /* ── Data type pills config (5 pills, 3 flip + 2 static) ── */
  const pillData = [
    { flip: true,  fill: 'rgba(99,102,241,0.08)',  stroke: 'rgba(99,102,241,0.20)',  text: '#a5b4fc', dot: 'rgba(99,102,241,0.4)' },
    { flip: true,  fill: 'rgba(14,165,233,0.08)',   stroke: 'rgba(14,165,233,0.20)',  text: '#7dd3fc', dot: 'rgba(14,165,233,0.4)' },
    { flip: true,  fill: 'rgba(245,158,11,0.08)',   stroke: 'rgba(245,158,11,0.20)',  text: '#fcd34d', dot: 'rgba(245,158,11,0.4)' },
    { flip: false, fill: 'rgba(20,184,166,0.08)',    stroke: 'rgba(20,184,166,0.20)',  text: '#5eead4', dot: 'rgba(20,184,166,0.4)', label: 'Логистика' },
    { flip: false, fill: 'rgba(244,63,94,0.08)',     stroke: 'rgba(244,63,94,0.20)',   text: '#fda4af', dot: 'rgba(244,63,94,0.4)',  label: 'СПП' },
  ];
  const pillYs = [62, 126, 190, 254, 318];

  /* ── Output cards config ── */
  const outputData = [
    { label: 'Дашборд', accent: '#6366f1', icon: 'M1,8 L1,3 L3,3 L3,8 M4,8 L4,1 L6,1 L6,8 M7,8 L7,5 L9,5 L9,8', delay: 1.3 },
    { label: 'Прибыль', accent: '#10b981', icon: 'M0,6 L3,3 L5,5 L8,1', delay: 1.4 },
    { label: 'Остатки', accent: '#0ea5e9', icon: 'M1,1 L7,1 L7,3 L1,3 Z M1,4 L7,4 L7,6 L1,6 Z M1,7 L7,7', delay: 1.5 },
    { label: 'reportCycle', accent: '#6366f1', icon: 'M0,0 L5,0 L8,3 L8,10 L0,10 Z M5,0 L5,3 L8,3', delay: 1.6 },
    { label: 'План',    accent: '#8b5cf6', icon: 'M2,0 L7,0 L7,9 L2,9 Z M4,3 L6,3 M4,5 L6,5 M4,7 L5,7', delay: 1.7 },
  ];
  const outputYs = [50, 118, 186, 254, 322];

  return (
    <section ref={sectionRef} id="dataflow" className="data-flow-section py-16 sm:py-24 overflow-hidden relative"
      aria-label="Схема потока данных от маркетплейсов к аналитике">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Data Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              Как данные становятся прибылью
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-lg mx-auto">
              От маркетплейсов к аналитике за 2 минуты
            </p>
          </div>
        </RevealSection>

        {/* ── Desktop diagram ── */}
        <div className="hidden sm:block relative">

          <svg viewBox="0 0 1100 520" className="w-full h-auto" fill="none"
            role="img" aria-label="Диаграмма: данные из маркетплейсов обрабатываются в RevioMP">
            <title>Поток данных RevioMP</title>
            <desc>Wildberries и Ozon подключены. Яндекс.Маркет, Авито и СберМегаМаркет скоро. Данные проходят через 6 категорий в RevioMP Analytics Hub.</desc>
            <defs>
              <pattern id="v4-dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="rgba(99,102,241,0.15)" />
              </pattern>
              <linearGradient id="v4-fade-v" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="15%" stopColor="white" stopOpacity="1" />
                <stop offset="85%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id="v4-dot-mask">
                <rect width="1100" height="520" fill="url(#v4-fade-v)" />
              </mask>
              <filter id="v4-hub-shadow" x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow dx="0" dy="8" stdDeviation="18" floodColor="rgba(99,102,241,0.30)" />
              </filter>
              <linearGradient id="v4-hub-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              {/* SPP directional clip - RAF controls rect x/width via sppClipRectD ref */}
              <clipPath id="spp-clip-D">
                <rect ref={sppClipRectD} x={338} y={236} width={0} height={104} />
              </clipPath>
            </defs>

            {/* Dot grid overlay */}
            <rect width="1100" height="520" fill="url(#v4-dot-grid)" opacity="0.4" mask="url(#v4-dot-mask)" />

            {/* ─── LINES: Sources -> Data Types ─── */}
            <path d={P.wbToPill1} stroke="rgba(139,63,253,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.3, 100)} />
            <path d={P.wbToPill2} stroke="rgba(139,63,253,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.35, 120)} />
            <path d={P.ozonToPill3} stroke="rgba(37,99,235,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.4, 100)} />
            <path d={P.ozonToPill4} stroke="rgba(37,99,235,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.45, 140)} />

            {/* ─── LINES: Data Types -> Hub ─── */}
            <path d={P.pill1ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.7, 200)} />
            <path d={P.pill2ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.75, 180)} />
            <path d={P.pill3ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.8, 160)} />
            <path d={P.pill4ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.85, 200)} />
            {/* SPP line: always dashed, visibility and directional grow/erase via clipPath (RAF-controlled) */}
            <path ref={sppLineRefD} d={P.pill5ToHub}
              stroke="rgba(244,63,94,0.45)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
              fill="none" strokeLinecap="round"
              strokeDasharray="8 8" strokeDashoffset="0"
              clipPath="url(#spp-clip-D)"
            />
            {/* SPP dot: RAF drives cx/cy/opacity; invisible until cycle starts */}
            <circle ref={sppDotRefD} cx={340} cy={336} r={3} fill="#fda4af" opacity={0}
              style={{ filter: 'drop-shadow(0 0 4px rgba(244,63,94,0.8))' }}
            />

            {/* Coming soon sources have no lines - they are just static cards */}

            {/* ─── LINES: Hub -> Outputs ─── */}
            <path d={P.hubToDash} stroke="rgba(99,102,241,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.0, 200)} />
            <path d={P.hubToPnl} stroke="rgba(99,102,241,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.1, 180)} />
            <path d={P.hubToStocks} stroke="rgba(99,102,241,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.2, 100)} />
            <path d={P.hubToReport} stroke="rgba(99,102,241,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.3, 200)} />
            <path d={P.hubToPlan} stroke="rgba(99,102,241,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.35, 220)} />

            {/* ─── LINES: Outputs -> Integrations ─── */}
            <path d={P.dashToTelegram} stroke="rgba(14,165,233,0.20)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.5, 80)} />
            <path d={P.dashToWebhook} stroke="rgba(16,185,129,0.20)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.6, 100)} />
            <path d={P.pnlToApi} stroke="rgba(99,102,241,0.20)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.7, 80)} />

            {/* ─── LINES: Report → Excel / PDF (conditional on cycle) ─── */}
            <path d={P.reportToExcel} stroke="rgba(34,197,94,0.20)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.8, 80)} />
            <path d={P.reportToPdf} stroke="rgba(239,68,68,0.20)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.9, 80)} />

            {/* ─── Conditional traveling packet: Отчёт→Excel, Презентация→PDF ─── */}
            {alive && !prefersReducedMotion.current && reportLabel === 'Отчёт' && (
              <circle r={2} fill="#22c55e" opacity={0.6}>
                <animateMotion dur="1.5s" begin="0s" repeatCount="indefinite" path={P.reportToExcel} />
              </circle>
            )}
            {alive && !prefersReducedMotion.current && reportLabel === 'Презентация' && (
              <circle r={2} fill="#ef4444" opacity={0.6}>
                <animateMotion dur="1.5s" begin="0s" repeatCount="indefinite" path={P.reportToPdf} />
              </circle>
            )}

            {/* ─── TRAVELING DATA PACKETS (continuous after alive) ─── */}
            {alive && !prefersReducedMotion.current && packets.map((p, i) => (
              <circle key={`pkt-${i}`} r={p.r} fill={p.c} opacity={p.op}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.path} />
              </circle>
            ))}

            {/* ═══ SOURCE CARDS ═══ */}
            {/* WB (Active) */}
            <g style={show(0)}>
              <g className={alive ? 'v4-source-pulse-wb' : ''}>
                <rect x="20" y="60" width="145" height="56" rx="14" fill="rgba(139,63,253,0.10)" stroke="rgba(139,63,253,0.30)" strokeWidth="1" />
                <circle cx="50" cy="88" r="14" fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.25)" strokeWidth="0.75" />
                <circle cx="50" cy="88" r="18" fill="none" stroke="rgba(139,63,253,0.15)" strokeWidth="1" strokeDasharray="4 6" className={alive ? 'v3-wb-ring' : ''} />
                <text x="50" y="92" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="700" fontFamily="Inter,sans-serif">WB</text>
                <text x="110" y="82" textAnchor="middle" fill="#c4b5fd" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
                <rect x="80" y="92" width="65" height="16" rx="8" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.25)" strokeWidth="0.5" />
                <circle cx="90" cy="100" r="2.5" fill="#22c55e" className="v3-status-pulse" />
                <text x="118" y="104" textAnchor="middle" fill="#4ade80" fontSize="7.5" fontWeight="500" fontFamily="Inter,sans-serif">Подключён</text>
              </g>
            </g>

            {/* Ozon (Active) */}
            <g style={show(0.10)}>
              <g className={alive ? 'v3-ozon-tilt' : ''}>
                <rect x="20" y="140" width="145" height="56" rx="14" fill="rgba(0,91,255,0.10)" stroke="rgba(0,91,255,0.30)" strokeWidth="1" />
                <circle cx="50" cy="168" r="14" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="50" cy="168" r="18" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="1.5" className="v3-ozon-ring" />}
                <text x="50" y="172" textAnchor="middle" fill="#60a5fa" fontSize="10" fontWeight="700" fontFamily="Inter,sans-serif">Oz</text>
                <text x="110" y="162" textAnchor="middle" fill="#93c5fd" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
                <rect x="80" y="172" width="65" height="16" rx="8" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.25)" strokeWidth="0.5" />
                <circle cx="90" cy="180" r="2.5" fill="#22c55e" className="v3-status-pulse" />
                <text x="118" y="184" textAnchor="middle" fill="#4ade80" fontSize="7.5" fontWeight="500" fontFamily="Inter,sans-serif">Подключён</text>
              </g>
            </g>

            {/* Яндекс.Маркет (Coming Soon) */}
            <g style={show(0.20)} opacity="0.35">
              <rect x="20" y="240" width="145" height="48" rx="12" fill="none" stroke="rgba(250,204,21,0.15)" strokeWidth="1" strokeDasharray="5 5" />
              <circle cx="46" cy="264" r="11" fill="rgba(250,204,21,0.06)" stroke="rgba(250,204,21,0.12)" strokeWidth="0.5" />
              <text x="46" y="268" textAnchor="middle" fill="rgba(250,204,21,0.5)" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Я</text>
              <text x="112" y="260" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10.5" fontWeight="500" fontFamily="Inter,sans-serif">Яндекс.Маркет</text>
              <rect x="88" y="270" width="44" height="14" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x="110" y="280" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">Скоро</text>
            </g>

            {/* Авито (Coming Soon) */}
            <g style={show(0.25)} opacity="0.35">
              <rect x="20" y="312" width="145" height="48" rx="12" fill="none" stroke="rgba(0,175,90,0.15)" strokeWidth="1" strokeDasharray="5 5" />
              <circle cx="46" cy="336" r="11" fill="rgba(0,175,90,0.06)" stroke="rgba(0,175,90,0.12)" strokeWidth="0.5" />
              <text x="46" y="340" textAnchor="middle" fill="rgba(0,175,90,0.5)" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Av</text>
              <text x="112" y="332" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10.5" fontWeight="500" fontFamily="Inter,sans-serif">Авито</text>
              <rect x="88" y="342" width="44" height="14" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x="110" y="352" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">Скоро</text>
            </g>

            {/* СберМегаМаркет (Coming Soon) */}
            <g style={show(0.30)} opacity="0.35">
              <rect x="20" y="384" width="145" height="48" rx="12" fill="none" stroke="rgba(33,160,56,0.15)" strokeWidth="1" strokeDasharray="5 5" />
              <circle cx="46" cy="408" r="11" fill="rgba(33,160,56,0.06)" stroke="rgba(33,160,56,0.12)" strokeWidth="0.5" />
              <text x="46" y="412" textAnchor="middle" fill="rgba(33,160,56,0.5)" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">СМ</text>
              <text x="112" y="404" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10.5" fontWeight="500" fontFamily="Inter,sans-serif">СберМега</text>
              <rect x="88" y="414" width="44" height="14" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x="110" y="424" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="500" fontFamily="Inter,sans-serif">Скоро</text>
            </g>

            {/* ═══ DATA TYPE PILLS (5: 3 flipping + 2 static) ═══ */}
            {pillData.map((pill, i) => {
              const label = pill.flip ? pillFlipCurrent[i] : pill.label;
              const isSppPill = !pill.flip && i === 4;
              return (
                <g key={`pill-${i}`}
                  ref={isSppPill ? sppPillRefD : undefined}
                  style={isSppPill ? { opacity: 0 } : show(0.30 + i * 0.06)}>
                  {/* glow wrapper - separate from flip group */}
                  <g className={alive ? 'v4-pill-glow' : ''} style={alive ? { animationDelay: `${i * 0.5}s` } : undefined}>
                    {/* flip wrapper - RAF drives scaleX directly; v3-pill-flip-base sets transform geometry only */}
                    <g ref={pill.flip ? pillRefsDesktop[i] : undefined}
                       className={pill.flip ? 'v3-pill-flip-base' : ''}>
                      <rect x={230} y={pillYs[i]} width={110} height={36} rx={18} fill={pill.fill} stroke={pill.stroke} strokeWidth="0.8" />
                      <circle cx={248} cy={pillYs[i] + 18} r={3} fill={pill.dot} className={alive ? 'v3-status-pulse' : ''} />
                      <text x={294} y={pillYs[i] + 22} textAnchor="middle" fill={pill.text} fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">{label}</text>
                    </g>
                  </g>
                </g>
              );
            })}

            {/* ═══ CENTRAL HUB ═══ */}
            <g style={show(0.6)}>
              <g filter="url(#v4-hub-shadow)">
                <rect x="445" y="155" width="190" height="110" rx="20" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" />
                <rect x="440" y="150" width="200" height="120" rx="24"
                  fill="none" stroke="url(#v4-hub-grad)" strokeWidth="1.5"
                  strokeDasharray="8 4" strokeOpacity="0.5" className="v3-hub-border" />
                <path d="M540,176 L548,184 L540,192 L532,184 Z" fill="rgba(99,102,241,0.3)" stroke="rgba(165,180,252,0.5)" strokeWidth="0.8" />
                <text x="540" y="218" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
                <text x="540" y="240" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">Умная аналитика</text>
              </g>
            </g>

            {/* ═══ OUTPUT CARDS (5) ═══ */}
            {outputData.map((out, i) => (
              <g key={`out-${i}`} style={show(out.delay)}>
                <rect x={710} y={outputYs[i]} width={140} height={48} rx={12} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                <rect x={710} y={outputYs[i] + 12} width={2.5} height={24} rx={1.25} fill={out.accent} opacity="0.4" />
                <g transform={`translate(${724},${outputYs[i] + 15})`} opacity="0.5">
                  <path d={out.icon} stroke={out.accent} strokeWidth="1" fill="none" strokeLinecap="round" />
                </g>
                <text x={794} y={outputYs[i] + 29} textAnchor="middle" fill="white" fontSize="11.5" fontWeight="600" fontFamily="Inter,sans-serif">{out.label === 'reportCycle' ? reportLabel : out.label}</text>
              </g>
            ))}

            {/* ═══ INTEGRATION BADGES ═══ */}
            <text x="970" y="46" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif" letterSpacing="0.05em" style={show(1.9)}>ИНТЕГРАЦИИ</text>

            <g style={show(2.0)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="920" y="60" width="100" height="32" rx="8" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.30)" strokeWidth="0.75" />
                <g transform="translate(932,69)" opacity="0.5"><path d="M0,5 L8,0 L6,8 L4,5.5 Z" fill="#38bdf8" /></g>
                <text x="978" y="80" textAnchor="middle" fill="#38bdf8" fontSize="9.5" fontWeight="600" fontFamily="Inter,sans-serif">Telegram</text>
              </g>
            </g>
            <g style={show(2.1)} opacity="0.85">
              <g className={alive ? 'v3-blink' : ''}>
                <rect x="920" y="108" width="100" height="32" rx="8" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.30)" strokeWidth="0.75" />
                <g transform="translate(932,117)" opacity="0.55"><path d="M5,0 L2,5 L5,5 L3,10" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g>
                <text x="978" y="128" textAnchor="middle" fill="#34d399" fontSize="9.5" fontWeight="600" fontFamily="Inter,sans-serif">Webhook</text>
              </g>
            </g>
            <g style={show(2.2)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="920" y="156" width="100" height="32" rx="8" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.30)" strokeWidth="0.75" />
                <text x="948" y="176" textAnchor="middle" fill="#818cf8" fontSize="10" fontWeight="700" fontFamily="monospace">{'</>'}</text>
                <text x="988" y="176" textAnchor="middle" fill="#818cf8" fontSize="9.5" fontWeight="600" fontFamily="Inter,sans-serif">REST API</text>
              </g>
            </g>

            {/* ═══ EXPORT BADGES ═══ */}
            <text x="970" y="264" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif" letterSpacing="0.05em" style={show(2.2)}>ЭКСПОРТ</text>

            <g style={show(2.3)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop' : ''}>
                <rect x="920" y="278" width="100" height="32" rx="8" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.35)" strokeWidth="0.75" />
                <g transform="translate(932,287)" opacity="0.45">
                  <rect width="9" height="9" rx="1.5" stroke="#4ade80" strokeWidth="0.8" fill="none" />
                  <line x1="4.5" y1="0" x2="4.5" y2="9" stroke="#4ade80" strokeWidth="0.5" />
                  <line x1="0" y1="4.5" x2="9" y2="4.5" stroke="#4ade80" strokeWidth="0.5" />
                </g>
                <text x="978" y="298" textAnchor="middle" fill="#4ade80" fontSize="9.5" fontWeight="600" fontFamily="Inter,sans-serif">Excel</text>
              </g>
            </g>
            <g style={show(2.4)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop v3-flip-delay' : ''}>
                <rect x="920" y="326" width="100" height="32" rx="8" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.35)" strokeWidth="0.75" />
                <g transform="translate(932,335)" opacity="0.45">
                  <path d="M0,0 L5,0 L8,3 L8,10 L0,10 Z" stroke="#f87171" strokeWidth="0.8" fill="none" />
                  <path d="M5,0 L5,3 L8,3" stroke="#f87171" strokeWidth="0.6" fill="none" />
                </g>
                <text x="978" y="346" textAnchor="middle" fill="#f87171" fontSize="9.5" fontWeight="600" fontFamily="Inter,sans-serif">PDF</text>
              </g>
            </g>
          </svg>
        </div>

        {/* ── Mobile: vertical flow ── */}
        <div className="sm:hidden relative p-2 overflow-hidden">
          <svg viewBox="0 0 320 580" className="w-full h-auto max-w-[360px] mx-auto" fill="none"
            role="img" aria-label="Диаграмма: данные из маркетплейсов обрабатываются в RevioMP">
            <title>Поток данных RevioMP</title>
            <desc>Wildberries и Ozon подключены. Данные проходят через RevioMP Analytics Hub в аналитику.</desc>
            <defs>
              <pattern id="v4-dot-grid-m" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.6" fill="rgba(99,102,241,0.15)" />
              </pattern>
              <linearGradient id="v4-fade-v-m" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="10%" stopColor="white" stopOpacity="1" />
                <stop offset="90%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id="v4-dot-mask-m">
                <rect width="320" height="580" fill="url(#v4-fade-v-m)" />
              </mask>
              <linearGradient id="v4-hub-grad-m" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <filter id="v4-hub-shadow-m" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(99,102,241,0.2)" />
              </filter>
              {/* SPP directional clip - RAF controls rect x/width via sppClipRectM ref */}
              <clipPath id="spp-clip-M">
                <rect ref={sppClipRectM} x={158} y={140} width={0} height={32} />
              </clipPath>
            </defs>

            {/* Dot grid */}
            <rect width="320" height="580" fill="url(#v4-dot-grid-m)" opacity="0.3" mask="url(#v4-dot-mask-m)" />

            {/* ─── MOBILE LINES: Sources -> Pills ─── */}
            <path d={PM.wbToRow1} stroke="rgba(139,63,253,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.3, 60, '4 8')} />
            <path d={PM.wbToRow1b} stroke="rgba(139,63,253,0.15)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.35, 100, '4 8')} />
            <path d={PM.ozonToRow1} stroke="rgba(37,99,235,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.35, 60, '4 8')} />
            <path d={PM.ozonToRow1b} stroke="rgba(37,99,235,0.15)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.4, 100, '4 8')} />

            {/* ─── MOBILE LINES: Pills -> Hub ─── */}
            <path d={PM.pill1ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.5, 140, '4 8')} />
            <path d={PM.pill2ToHub} stroke="rgba(99,102,241,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.55, 70, '4 8')} />
            <path d={PM.pill3ToHub} stroke="rgba(99,102,241,0.30)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.5, 140, '4 8')} />
            <path d={PM.pill4ToHub} stroke="rgba(99,102,241,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.6, 100, '4 8')} />
            {/* Mobile SPP line: always dashed, clipPath controls directional grow/erase */}
            <path ref={sppLineRefM} d={PM.pill5ToHub}
              stroke="rgba(244,63,94,0.45)" strokeWidth={1.2} vectorEffect="non-scaling-stroke"
              fill="none" strokeLinecap="round"
              strokeDasharray="8 8" strokeDashoffset="0"
              clipPath="url(#spp-clip-M)"
            />
            {/* Mobile SPP dot: RAF drives position/opacity */}
            <circle ref={sppDotRefM} cx={209} cy={144} r={2.5} fill="#fda4af" opacity={0}
              style={{ filter: 'drop-shadow(0 0 3px rgba(244,63,94,0.8))' }}
            />

            {/* ─── MOBILE LINES: Hub -> Outputs ─── */}
            <path d={PM.hubToOut1} stroke="rgba(99,102,241,0.40)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.9, 140, '4 8')} />
            <path d={PM.hubToOut2} stroke="rgba(99,102,241,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.95, 40, '4 8')} />
            <path d={PM.hubToOut3} stroke="rgba(99,102,241,0.40)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.9, 140, '4 8')} />
            <path d={PM.hubToOut4} stroke="rgba(99,102,241,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.0, 120, '4 8')} />
            <path d={PM.hubToOut5} stroke="rgba(99,102,241,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.0, 120, '4 8')} />

            {/* ─── MOBILE LINES: Outputs -> Badges ─── */}
            <path d={PM.out1ToBdg1} stroke="rgba(14,165,233,0.20)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.3, 80, '4 8')} />
            <path d={PM.out2ToBdg2} stroke="rgba(16,185,129,0.20)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.3, 80, '4 8')} />
            <path d={PM.out3ToBdg3} stroke="rgba(99,102,241,0.20)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.3, 80, '4 8')} />
            <path d={PM.out4ToBdg4} stroke="rgba(34,197,94,0.20)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.5, 80, '4 8')} />
            <path d={PM.out5ToBdg5} stroke="rgba(239,68,68,0.20)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.5, 80, '4 8')} />

            {/* ─── MOBILE TRAVELING PACKETS ─── */}
            {alive && !prefersReducedMotion.current && mobilePackets.map((p, i) => (
              <circle key={`m-pkt-${i}`} r={p.r} fill={p.c} opacity={p.op}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.path} />
              </circle>
            ))}

            {/* ═══ MOBILE SOURCES ═══ */}
            <g style={show(0)}>
              <g className={alive ? 'v4-source-pulse-wb' : ''}>
                <rect x="18" y="10" width="130" height="42" rx="12" fill="rgba(139,63,253,0.10)" stroke="rgba(139,63,253,0.30)" strokeWidth="1" />
                <circle cx="40" cy="31" r="11" fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="40" cy="31" r="14" fill="none" stroke="rgba(139,63,253,0.15)" strokeWidth="1" strokeDasharray="3 5" className="v3-wb-ring" />}
                <text x="40" y="35" textAnchor="middle" fill="#a78bfa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">WB</text>
                <text x="98" y="35" textAnchor="middle" fill="#c4b5fd" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
                <circle cx="141" cy="18" r="2.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>
            <g style={show(0.10)}>
              <g className={alive ? 'v3-ozon-tilt' : ''}>
                <rect x="172" y="10" width="130" height="42" rx="12" fill="rgba(0,91,255,0.10)" stroke="rgba(0,91,255,0.30)" strokeWidth="1" />
                <circle cx="194" cy="31" r="11" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="194" cy="31" r="14" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="1" className="v3-ozon-ring" />}
                <text x="194" y="35" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Oz</text>
                <text x="248" y="35" textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
                <circle cx="295" cy="18" r="2.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            {/* ═══ MOBILE DATA PILLS (row1: 3 flipping, row2: 2 static centered) ═══ */}
            {[
              { x: 18,  y: 78,  flipIdx: 0,  fill: pillData[0].fill, stroke: pillData[0].stroke, text: pillData[0].text, dot: pillData[0].dot },
              { x: 116, y: 78,  flipIdx: 1,  fill: pillData[1].fill, stroke: pillData[1].stroke, text: pillData[1].text, dot: pillData[1].dot },
              { x: 214, y: 78,  flipIdx: 2,  fill: pillData[2].fill, stroke: pillData[2].stroke, text: pillData[2].text, dot: pillData[2].dot },
              { x: 67,  y: 116, flipIdx: -1, label: 'Логистика', fill: pillData[3].fill, stroke: pillData[3].stroke, text: pillData[3].text, dot: pillData[3].dot },
              { x: 165, y: 116, flipIdx: -1, label: 'СПП',       fill: pillData[4].fill, stroke: pillData[4].stroke, text: pillData[4].text, dot: pillData[4].dot },
            ].map((mp, i) => {
              const isFlip = mp.flipIdx >= 0;
              const label  = isFlip ? pillFlipCurrent[mp.flipIdx] : mp.label;
              const isMSppPill = !isFlip && i === 4;
              return (
                <g key={`m-pill-${i}`}
                  ref={isMSppPill ? sppPillRefM : undefined}
                  style={isMSppPill ? { opacity: 0 } : show(0.25 + i * 0.04)}>
                  {/* flip wrapper - RAF drives scaleX; v3-pill-flip-base sets geometry only */}
                  <g ref={isFlip ? pillRefsMobile[mp.flipIdx] : undefined}
                     className={isFlip ? 'v3-pill-flip-base' : ''}>
                    <rect x={mp.x} y={mp.y} width={88} height={28} rx={14} fill={mp.fill} stroke={mp.stroke} strokeWidth="0.8" />
                    <circle cx={mp.x + 14} cy={mp.y + 14} r={2.5} fill={mp.dot} className={alive ? 'v3-status-pulse' : ''} />
                    <text x={mp.x + 50} y={mp.y + 18} textAnchor="middle" fill={mp.text} fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif">{label}</text>
                  </g>
                </g>
              );
            })}

            {/* ═══ MOBILE HUB ═══ */}
            <g style={show(0.55)}>
              <g filter="url(#v4-hub-shadow-m)">
                <rect x="40" y="174" width="240" height="64" rx="16" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" />
                <rect x="36" y="170" width="248" height="72" rx="20"
                  fill="none" stroke="url(#v4-hub-grad-m)" strokeWidth="1.5"
                  strokeDasharray="8 4" strokeOpacity="0.5" className="v3-hub-border" />
                <path d="M160,182 L166,188 L160,194 L154,188 Z" fill="rgba(99,102,241,0.3)" stroke="rgba(165,180,252,0.5)" strokeWidth="0.8" />
                <text x="160" y="212" textAnchor="middle" fill="white" fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
                <text x="160" y="228" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="500" fontFamily="Inter,sans-serif">Умная аналитика</text>
              </g>
            </g>

            {/* ═══ MOBILE OUTPUTS (row1: 3, row2: 2 centered) ═══ */}
            {[
              { x: 18, y: 275, label: 'Дашборд', accent: '#6366f1' },
              { x: 116, y: 275, label: 'Прибыль', accent: '#10b981' },
              { x: 214, y: 275, label: 'Остатки', accent: '#0ea5e9' },
              { x: 52, y: 316, label: 'reportCycle', accent: '#6366f1', w: 100 },
              { x: 168, y: 316, label: 'План', accent: '#8b5cf6', w: 100 },
            ].map((mo, i) => (
              <g key={`m-out-${i}`} style={show(1.1 + i * 0.08)}>
                <rect x={mo.x} y={mo.y} width={mo.w || 88} height={30} rx={10} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                <rect x={mo.x} y={mo.y + 8} width={2} height={14} rx={1} fill={mo.accent} opacity="0.4" />
                <text x={mo.x + (mo.w || 88) / 2} y={mo.y + 19} textAnchor="middle" fill="white" fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif">{mo.label === 'reportCycle' ? reportLabel : mo.label}</text>
              </g>
            ))}

            {/* ═══ MOBILE BADGES (row1: 3, row2: 2 centered) ═══ */}
            <g style={show(1.5)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="18" y="380" width="88" height="24" rx="7" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.30)" strokeWidth="0.75" />
                <text x="62" y="396" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">Telegram</text>
              </g>
            </g>
            <g style={show(1.55)} opacity="0.85">
              <g className={alive ? 'v3-blink' : ''}>
                <rect x="116" y="380" width="88" height="24" rx="7" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.30)" strokeWidth="0.75" />
                <text x="160" y="396" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">Webhook</text>
              </g>
            </g>
            <g style={show(1.6)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="214" y="380" width="88" height="24" rx="7" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.30)" strokeWidth="0.75" />
                <text x="258" y="396" textAnchor="middle" fill="#818cf8" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">REST API</text>
              </g>
            </g>
            <g style={show(1.7)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop' : ''}>
                <rect x="67" y="414" width="88" height="24" rx="7" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.35)" strokeWidth="0.75" />
                <text x="111" y="430" textAnchor="middle" fill="#4ade80" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">Excel</text>
              </g>
            </g>
            <g style={show(1.75)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop v3-flip-delay' : ''}>
                <rect x="165" y="414" width="88" height="24" rx="7" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.35)" strokeWidth="0.75" />
                <text x="209" y="430" textAnchor="middle" fill="#f87171" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">PDF</text>
              </g>
            </g>

            {/* ═══ MOBILE COMING SOON ═══ */}
            <g style={show(1.9)} opacity="0.35">
              <rect x="10" y="465" width="96" height="22" rx="6" fill="none" stroke="rgba(250,204,21,0.15)" strokeWidth="0.75" strokeDasharray="3 3" />
              <text x="58" y="480" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="Inter,sans-serif">Я.Маркет</text>
              <rect x="112" y="465" width="80" height="22" rx="6" fill="none" stroke="rgba(0,175,90,0.15)" strokeWidth="0.75" strokeDasharray="3 3" />
              <text x="152" y="480" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="Inter,sans-serif">Авито</text>
              <rect x="198" y="465" width="112" height="22" rx="6" fill="none" stroke="rgba(33,160,56,0.15)" strokeWidth="0.75" strokeDasharray="3 3" />
              <text x="254" y="480" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="Inter,sans-serif">СберМега</text>
              <text x="160" y="502" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="Inter,sans-serif">Скоро подключим</text>
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   HOW IT WORKS
   ────────────────────────────────────────────── */

function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Зарегистрируйтесь',
      description: 'Создайте аккаунт за 30 секунд. Без привязки карты.',
    },
    {
      number: '2',
      title: 'Добавьте API-токены',
      description: 'Подключите WB и Ozon через API-ключи из личных кабинетов.',
    },
    {
      number: '3',
      title: 'Получайте аналитику',
      description: 'Данные загрузятся автоматически. Дашборд готов через 2-3 минуты.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Как это работает
          </h2>
        </RevealSection>
        <div className="mt-12 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden sm:block absolute top-6 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 relative">
            {steps.map((step, i) => (
              <RevealSection key={step.number} delay={i * 120}>
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-200/50 relative z-10">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 max-w-xs mx-auto">{step.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   SECURITY
   ────────────────────────────────────────────── */

function SecuritySection() {
  const points = [
    {
      icon: Lock,
      title: 'Шифрование токенов',
      description: 'API-ключи шифруются алгоритмом Fernet и хранятся в зашифрованном виде.',
    },
    {
      icon: Eye,
      title: 'Только чтение',
      description: 'Мы используем только read-only доступ к API маркетплейсов. Никаких изменений.',
    },
    {
      icon: ShieldCheck,
      title: 'Изоляция данных',
      description: 'Row Level Security: каждый пользователь видит только свои данные.',
    },
  ];

  return (
    <section id="security" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Безопасность данных
          </h2>
          <p className="mt-3 text-gray-500 text-center max-w-lg mx-auto">
            Ваши данные защищены на всех уровнях
          </p>
        </RevealSection>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {points.map((p, i) => {
            const Icon = p.icon;
            return (
              <RevealSection key={p.title} delay={i * 100}>
                <div className="text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 hover:shadow-md transition-shadow h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.description}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   PRICING
   ────────────────────────────────────────────── */

interface PricingFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
}

const pricingFeatures: PricingFeature[] = [
  { name: 'Дашборд', free: true, pro: true },
  { name: 'Маркетплейсы', free: 'WB', pro: 'WB + Ozon' },
  { name: 'Макс. SKU', free: '3', pro: '20' },
  { name: 'Авто-синхронизация', free: '2 раза/день', pro: 'каждые 6ч' },
  { name: 'Ручное обновление', free: false, pro: '1/день' },
  { name: 'Удержания (детализация)', free: false, pro: true },
  { name: 'Unit-экономика', free: false, pro: true },
  { name: 'Реклама и ДРР', free: false, pro: true },
  { name: 'PDF экспорт', free: false, pro: true },
  { name: 'Сравнение периодов', free: false, pro: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-gray-700 font-medium">{value}</span>;
  }
  return value ? (
    <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
  ) : (
    <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
  );
}

function PricingSection() {
  const spotlightMove = useSpotlight();
  return (
    <section id="pricing" className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Простые и понятные тарифы
            </h2>
            <p className="mt-3 text-gray-500">
              Начните бесплатно - обновитесь, когда будете готовы.
            </p>
          </div>
        </RevealSection>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <RevealSection>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border border-gray-200 p-3 sm:p-6 hover:shadow-lg transition-shadow h-full">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Free</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Для старта</p>
              <div className="mt-3 sm:mt-5">
                <span className="text-2xl sm:text-4xl font-extrabold text-gray-900">0 ₽</span>
                <span className="text-xs sm:text-sm text-gray-500 ml-1">навсегда</span>
              </div>
              <Link
                to="/login?signup=1"
                className="mt-4 sm:mt-6 text-center px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] flex items-center justify-center border border-gray-300 text-xs sm:text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                Начать бесплатно
              </Link>
              <ul className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                {['Дашборд с ключевыми метриками', 'Wildberries', 'До 3 SKU', 'Синхронизация 2 раза/день'].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-1.5 sm:gap-2.5 text-xs sm:text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </RevealSection>

          {/* Pro */}
          <RevealSection delay={100}>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border-2 border-indigo-600 p-3 sm:p-6 relative hover:shadow-xl hover:shadow-indigo-100 transition-shadow h-full">
              <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-md whitespace-nowrap">
                Рекомендуем
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Pro</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Для растущего бизнеса</p>
              <div className="mt-3 sm:mt-5">
                <span className="text-2xl sm:text-4xl font-extrabold text-gray-900">990 ₽</span>
                <span className="text-xs sm:text-sm text-gray-500 ml-1">/мес</span>
              </div>
              <Link
                to="/login?signup=1&plan=pro"
                className="mt-4 sm:mt-6 text-center px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 text-xs sm:text-sm font-semibold text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200/50"
              >
                Попробовать Pro
              </Link>
              <ul className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                {[
                  { text: 'Всё из Free, плюс:', highlight: true },
                  { text: 'WB + Ozon', highlight: false },
                  { text: 'До 20 SKU', highlight: false },
                  { text: 'Синхронизация каждые 6 часов', highlight: false },
                  { text: 'Детализация удержаний', highlight: false },
                  { text: 'Unit-экономика', highlight: false },
                  { text: 'Реклама и ДРР', highlight: false },
                  { text: 'PDF экспорт', highlight: false },
                  { text: 'Сравнение периодов', highlight: false },
                ].map((f) => (
                  <li
                    key={f.text}
                    className={`flex items-start gap-1.5 sm:gap-2.5 text-xs sm:text-sm ${f.highlight ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}
                  >
                    {!f.highlight && <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mt-0.5 shrink-0" />}
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </RevealSection>
        </div>

        {/* Comparison table */}
        <RevealSection className="mt-12">
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl mx-auto text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">Функция</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-700 w-28">Free</th>
                  <th className="text-center py-3 px-3 font-semibold text-indigo-700 w-28">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingFeatures.map((f) => (
                  <tr key={f.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 text-gray-600">{f.name}</td>
                    <td className="py-3 px-3 text-center">
                      <FeatureValue value={f.free} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureValue value={f.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FAQ
   ────────────────────────────────────────────── */

function FAQAccordionItem({
  question,
  answer,
  index,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const questionId = `faq-q-${index}`;
  const answerId = `faq-a-${index}`;

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        id={questionId}
        className="flex items-center justify-between w-full py-5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={answerId}
      >
        <span className="text-base font-medium text-gray-900 pr-8 group-hover:text-indigo-600 transition-colors sm:text-lg">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-sm text-gray-600 leading-relaxed pr-12 sm:text-base">{answer}</p>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: 'Какие маркетплейсы поддерживаются?',
    answer:
      'Wildberries и Ozon. Данные загружаются через официальные API маркетплейсов и отображаются в едином дашборде. Вы видите продажи, прибыль, удержания и остатки по обоим площадкам одновременно.',
  },
  {
    question: 'Безопасно ли подключать API-токены?',
    answer:
      'Да. Токены шифруются алгоритмом Fernet и хранятся только в зашифрованном виде. Мы запрашиваем доступ исключительно на чтение - сервис не может менять цены, карточки или делать поставки. Ваши магазины в полной безопасности.',
  },
  {
    question: 'Как считается прибыль?',
    answer:
      'Чистая прибыль = сумма перечислений от маркетплейса минус закупочная цена минус расходы на рекламу. Все удержания (комиссия, логистика, хранение, штрафы, эквайринг) уже учтены в перечислениях. Расчёт верифицирован по финансовым отчётам WB и Ozon с точностью до копейки.',
  },
  {
    question: 'Что входит в бесплатный тариф?',
    answer:
      'Free-тариф работает без ограничений по времени. Он включает основной дашборд с ключевыми метриками, подключение 1 маркетплейса и аналитику до 3 товаров. Этого достаточно, чтобы оценить сервис на реальных данных.',
  },
  {
    question: 'Чем Pro отличается от бесплатного?',
    answer:
      'Pro снимает все лимиты: оба маркетплейса, неограниченное число товаров, аналитика FBO и FBS, план продаж с прогнозом, экспорт в Excel и PDF, до 3 синхронизаций в день. Все функции, которые видите на скриншотах выше - доступны в Pro.',
  },
  {
    question: 'Как часто обновляются данные?',
    answer:
      'Данные синхронизируются автоматически. На Free-тарифе - 2 раза в день, на Pro - до 3 раз, на Business - до 4 раз. Также можно запустить обновление вручную из настроек. Утром вы уже видите вчерашние цифры.',
  },
  {
    question: 'Могу ли я настроить дашборд под себя?',
    answer:
      'Да. Дашборд состоит из виджетов, которые можно перетаскивать, добавлять и убирать. Выберите метрики, которые важны именно вам, и расставьте их в удобном порядке. Конфигурация сохраняется автоматически.',
  },
  {
    question: 'Как отменить подписку?',
    answer:
      'В разделе Настройки, вкладка Тариф. Отмена в один клик, без звонков и писем в поддержку. Доступ к платным функциям сохраняется до конца оплаченного периода.',
  },
] as const;

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.12em] bg-indigo-50 px-3.5 py-1.5 rounded-full mb-5">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Частые вопросы
            </h2>
          </div>
        </RevealSection>
        <RevealSection>
          <div className="divide-y divide-gray-200 border-t border-gray-200">
            {FAQ_ITEMS.map((faq, i) => (
              <FAQAccordionItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                index={i}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </RevealSection>
        <RevealSection>
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Не нашли ответ?{' '}
              <a
                href="mailto:support@reviomp.ru"
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Напишите нам
              </a>
            </p>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FINAL CTA
   ────────────────────────────────────────────── */

function FinalCTASection() {
  return (
    <section className="relative py-20 sm:py-24 overflow-hidden">
      {/* Animated gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Начните считать прибыль правильно
          </h2>
          <p className="mt-4 text-indigo-100 text-lg leading-relaxed">
            Подключите маркетплейсы за 2 минуты и увидите реальную картину бизнеса.
          </p>
          <Link
            to="/login?signup=1"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl"
          >
            Начать бесплатно <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-indigo-200 text-sm">
            Бесплатно навсегда. Без привязки карты.
          </p>
        </RevealSection>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FOOTER - Enterprise
   ────────────────────────────────────────────── */

const FOOTER_NAV = [
  { id: 'features', label: 'Возможности' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'how-it-works', label: 'Как это работает' },
] as const;

const FOOTER_RESOURCES = [
  { id: 'security', label: 'Безопасность' },
  { id: 'faq', label: 'Частые вопросы' },
  { id: 'dataflow', label: 'DataFlow' },
] as const;

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

function FooterSection() {
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
          {/* ── Upper area: Logo + Tagline + Status ── */}
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

          {/* ── Divider ── */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

          {/* ── Main columns ── */}
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
                    href="https://t.me/reviomp"
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
                  href="https://t.me/reviomp"
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

          {/* ── Divider ── */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

          {/* ── Bottom bar ── */}
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

/* ──────────────────────────────────────────────
   MAIN EXPORT
   ────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <NavBar />
      <HeroSection />
      <TrustBar />
      <ProductShowcase />
      <SocialProofSection />
      <SectionDivider />
      <StatsBar />
      <SectionDivider />
      <ProblemSection />
      <SectionDivider />
      <FeaturesSection />
      {/* DataFlow has dark bg - no divider needed */}
      <DataFlowSectionV4 />
      <HowItWorksSection />
      <SectionDivider />
      <SecuritySection />
      <SectionDivider />
      <PricingSection />
      <SectionDivider />
      <FAQSection />
      {/* FinalCTA has gradient bg - no divider needed */}
      <FinalCTASection />
      <FooterSection />
    </div>
  );
}
