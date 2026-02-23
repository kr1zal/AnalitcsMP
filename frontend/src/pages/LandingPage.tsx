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
    // Elements already in viewport on load — reveal immediately, no animation
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

/** Matrix digital rain — spiral-flow animation for hero background */
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let W: number, H: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const chars = '01234567₽%+-.∑↑↓→←';
    const fontSize = 14;
    const gap = 22;
    let cols: number;
    let drops: number[];
    let speeds: number[];

    const init = () => {
      cols = Math.ceil(W / gap) + 1;
      drops = Array.from({ length: cols }, () => Math.random() * -H / fontSize);
      speeds = Array.from({ length: cols }, () => 0.35 + Math.random() * 0.55);
    };
    init();

    let frame = 0;
    let animId: number;
    let last = 0;
    const fpsInterval = 1000 / 16;

    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);
      if (now - last < fpsInterval) return;
      last = now;

      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `500 ${fontSize}px "Courier New",monospace`;

      for (let i = 0; i < cols; i++) {
        const c = chars[Math.floor(Math.random() * chars.length)];
        const wave = Math.sin(drops[i] * 0.06 + i * 0.35 + frame * 0.012) * 10;
        const x = i * gap + wave;
        const y = drops[i] * fontSize;

        const v = (i + Math.floor(drops[i])) % 3;
        ctx.fillStyle = v === 0
          ? 'rgba(99,102,241,0.5)'
          : v === 1
            ? 'rgba(139,92,246,0.4)'
            : 'rgba(129,140,248,0.45)';

        ctx.fillText(c, x, y);

        if (y > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += speeds[i];
      }
      frame++;
    };

    animId = requestAnimationFrame(tick);
    const onResize = () => { resize(); init(); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 15%, rgba(0,0,0,0.4) 40%, black 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 15%, rgba(0,0,0,0.4) 40%, black 70%)',
      }}
    />
  );
}

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
          {/* Logo — clickable, scrolls to top */}
          <button onClick={scrollToTop} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <BarChart3 className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Revio<span className="text-indigo-600">MP</span>
            </span>
          </button>

          {/* Desktop nav — clean gaps, no cell borders */}
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

      {/* Matrix digital rain animation */}
      <MatrixRain />

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

        {/* Subheadline — 2 lines max on desktop */}
        <p className="animate-fade-up delay-200 mt-5 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Выручка, прибыль, удержания, реклама и&nbsp;остатки — в&nbsp;реальном времени.
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
    <div className="max-w-6xl mx-auto border-t border-b border-gray-200 py-5 overflow-hidden">
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
   PRODUCT SHOWCASE — Enterprise Tab Slider
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
    title: 'Настраиваемый дашборд',
    description: 'Drag & drop виджеты — соберите свою панель аналитики за 5 минут',
    highlights: ['16+ метрик', 'WB + Ozon', 'Автосинхронизация'],
    desktop: '/screenshots/desktop-1.png',
    mobile: '/screenshots/mobile-3.png',
  },
  {
    id: 'unit-economics',
    tab: 'Юнит-экономика',
    icon: TrendingUp,
    title: 'Прибыль по каждому товару',
    description: 'Себестоимость, маржа, ДРР — до копейки по каждому SKU',
    highlights: ['FBO / FBS разбивка', 'Водопад затрат', 'По маркетплейсам'],
    desktop: '/screenshots/desktop-2.png',
    mobile: '/screenshots/mobile-1.png',
  },
  {
    id: 'stocks',
    tab: 'Остатки',
    icon: ClipboardList,
    title: 'Запасы под контролем',
    description: 'Прогноз по дням, OOS-алерты, все склады в одной таблице',
    highlights: ['Прогноз 30 дней', 'OOS-алерты', 'Все склады'],
    desktop: '/screenshots/desktop-3.png',
    mobile: '/screenshots/mobile-2.png',
  },
];

const SHOWCASE_AUTOPLAY_MS = 6000;

/** macOS-style browser chrome frame */
function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-200/80 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 ml-3 max-w-[280px] mx-auto">
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200">
            <Lock className="w-3 h-3 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">reviomp.ru</span>
          </div>
        </div>
      </div>
      <div className="relative">
        {children}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/70 to-transparent pointer-events-none" />
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

  return (
    <RevealSection className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            Продукт
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-900 leading-tight">
            Посмотрите, как это работает
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Три ключевых экрана, которые заменят Excel и&nbsp;ручные отчёты
          </p>
        </div>

        {/* Tab navigation with progress indicator */}
        <div
          className="flex justify-center gap-2 sm:gap-3 mb-8 sm:mb-10"
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
                aria-selected={isActive}
                onClick={() => goTo(i)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className={`
                  relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-300 overflow-hidden
                  ${isActive
                    ? 'bg-white text-gray-900 shadow-lg shadow-gray-200/50 border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'}
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{s.tab}</span>
                {isActive && !paused && (
                  <span
                    key={progressKey}
                    className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 showcase-tab-progress"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Screenshot showcase */}
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Background glow */}
          <div className="absolute -inset-8 sm:-inset-12 bg-gradient-to-b from-indigo-50/40 via-transparent to-transparent rounded-3xl pointer-events-none" />

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
              {/* Decorative orbs behind phone */}
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

        {/* Feature details + device toggle */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
          <div className="text-center sm:text-left min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{slide.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{slide.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              {slide.highlights.map(h => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100"
                >
                  <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Device toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                device === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-label="Десктоп"
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                device === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-label="Мобильный"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
          </div>
        </div>
      </div>
    </RevealSection>
  );
}

/* ──────────────────────────────────────────────
   SOCIAL PROOF — Enterprise Testimonials Marquee
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
    quote: 'Раньше каждый понедельник убивал полдня на Excel — сводил выручку, вычитал комиссии, пытался понять прибыль. Подключил сервис — и через 10 минут увидел цифру, которая совпала с моим расчётом. Только без четырёх часов работы.',
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
    quote: 'У меня 12 SKU на Ozon, и я искренне не понимала, почему при хорошей выручке на счёт приходит копейки. Дерево удержаний показало: 23% уходило на логистику FBO. Перенесла часть на FBS — маржа выросла на 8 процентных пунктов.',
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
    quote: 'Торгую одновременно на WB и Ozon. Открывать два личных кабинета, выгружать отчёты, сводить в таблице — это был ад. Здесь оба маркетплейса в одном экране, и я вижу, где какой товар приносит больше. Решения принимаю за минуты.',
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
    quote: 'Юнит-экономика спасла мой бизнес. Я думала, что все 8 позиций прибыльные. Оказалось, два SKU работали в минус из-за высокой комиссии и возвратов. Убрала их — общая прибыль выросла, хотя выручка снизилась.',
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
    quote: 'Дважды попадал на OOS — товар кончился, карточка улетела вниз, потом две недели восстанавливал позиции. С прогнозом остатков вижу, когда нужно заказывать поставку. Уже два месяца без единого out-of-stock.',
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
    quote: 'Лила деньги в рекламу на WB и не понимала, окупается она или нет. В аналитике увидела ДРР 18% — при марже 22% это почти ноль прибыли. Перераспределила бюджет на топовые карточки, ДРР упал до 9%.',
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
    quote: 'Ставил план продаж наобум — просто \"хочу миллион\". Теперь вижу реальный темп: сколько продаю в день, укладываюсь или нет, прогноз на конец месяца. В январе впервые выполнил план на 94%. Просто потому что видел, где отстаю.',
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
    quote: 'Каждое утро данные уже обновлены. Не нужно ничего выгружать, импортировать, ждать. Открываю дашборд — и сразу вижу вчерашнюю прибыль, остатки, рекламу. Для меня это как иметь финдиректора, который работает 24/7.',
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
    // Only handle touch (not mouse on desktop — desktop uses hover pause)
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
      description: 'Логистика, хранение, штрафы — разбросаны по десяткам отчётов. Реальную прибыль посчитать невозможно.',
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
    },
    {
      icon: RefreshCw,
      title: 'Потеря времени',
      description: 'Вместо развития бизнеса — бесконечная сверка цифр между маркетплейсами.',
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
      description: 'Детализация расходов: комиссии, логистика, хранение, штрафы — как в ЛК, но нагляднее.',
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
      description: 'Расходы на рекламу, ДРР по дням, ROI кампаний — WB и Ozon в одном месте.',
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
   DATAFLOW V3 — LIVING ECOSYSTEM
   Every element has its own rhythm and animation type.
   No synchronized breathing — organic, independent motion.
   Traveling dots on lines, varied label transitions,
   unique micro-animations per badge.
   ────────────────────────────────────────────── */

function DataFlowSectionV3() {
  const SHOW_PRO = false; // flip to true when Order Monitor is ready
  const [triggered, setTriggered] = useState(false);
  const [alive, setAlive] = useState(false);
  const [proActive, setProActive] = useState(false);
  const [tick, setTick] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  /* ── Scroll trigger ── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTriggered(true); obs.unobserve(el); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Alive flag: micro-animations start after entrance completes ── */
  useEffect(() => {
    if (!triggered) return;
    const t = setTimeout(() => setAlive(true), 3200);
    return () => clearTimeout(t);
  }, [triggered]);

  /* ── Master tick (1s interval, drives all label cycling) ── */
  useEffect(() => {
    if (!alive) return;
    setTick(0);
    const t = setInterval(() => setTick(c => c + 1), 1000);
    return () => clearInterval(t);
  }, [alive]);

  /* ── Content derivation (each output cycles at its own rate + offset) ── */
  const o1Labels = ['Дашборд', 'Графики', 'Аналитика'];
  const o2Labels = ['Прибыль', 'Маржа', 'ROI'];
  const o3Labels = ['Отчёт', 'Презентация'];
  const roiValues = ['+42%', '+38%', '+55%', '+47%'];

  const o1 = tick >= 0 ? o1Labels[Math.floor(tick / 4) % 3] : o1Labels[0];
  const o2 = tick >= 0 ? o2Labels[Math.floor((tick + 2) / 3) % 3] : o2Labels[0];
  const o3Cycle = tick >= 0 ? Math.floor((tick + 1) / 5) : -1;
  const o3 = tick >= 0 ? o3Labels[o3Cycle % 2] : o3Labels[0];
  const roi = tick >= 0 ? roiValues[Math.floor((tick + 3) / 4) % 4] : roiValues[0];

  /* ── Shelf: cycling data categories from V2 (3 cards) ── */
  const shelfLabels = [
    ['Продажи', 'Заказы', 'Выкупы'],
    ['Остатки', 'FBO', 'Склады'],
    ['Реклама', 'Удержания', 'Комиссия'],
  ];
  const shelfCX = [310, 440, 570];          // card centers X (spread to avoid line crossings)
  const shelfCycle = tick >= 0 ? Math.floor(tick / 3) : 0;
  const shelf = shelfLabels.map((labels, i) =>
    tick >= 0 ? labels[(shelfCycle + i) % 3] : labels[0]
  );
  const activeSlot = tick >= 0 ? shelfCycle % 3 : -1;

  /* ── Entrance helper (one-shot, staggered) ── */
  const show = (delay: number): React.CSSProperties => ({
    opacity: triggered ? 1 : 0,
    transform: triggered ? 'scale(1)' : 'scale(0.8)',
    transition: triggered
      ? `opacity 0.5s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.5s cubic-bezier(.4,0,.2,1) ${delay}s`
      : 'none',
  });

  /* ── Line draw-on helper (draws once, stays with varied dash pattern) ── */
  const draw = (delay: number, len: number, dashPat = '2 4') => ({
    strokeDasharray: triggered ? dashPat : `${len}`,
    strokeDashoffset: triggered ? 0 : len,
    style: {
      transition: triggered
        ? `stroke-dashoffset 1.2s cubic-bezier(.66,0,.34,1) ${delay}s, stroke-dasharray 0.01s linear ${delay + 1.2}s`
        : 'none',
    } as React.CSSProperties,
  });

  /* ── Pro-tree entrance/exit helpers ── */
  const proShow = (d: number): React.CSSProperties => ({
    opacity: proActive ? 1 : 0,
    transform: proActive ? 'scale(1)' : 'scale(0.5)',
    transition: `opacity 0.35s cubic-bezier(.4,0,.2,1) ${proActive ? d : 0}s, transform 0.35s cubic-bezier(.4,0,.2,1) ${proActive ? d : 0}s`,
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
  });

  const proDraw = (d: number, len: number) => ({
    strokeDasharray: proActive ? '3 4' : `${len}`,
    strokeDashoffset: proActive ? 0 : len,
    style: {
      transition: proActive
        ? `stroke-dashoffset 0.5s ease ${d}s, stroke-dasharray 0.01s linear ${d + 0.5}s`
        : `stroke-dashoffset 0.3s ease 0s, stroke-dasharray 0.01s linear 0s`,
    } as React.CSSProperties,
  });

  /* ── Path definitions ── */
  const P = {
    wbToHub:   'M178,173 L298,173 L298,238 L416,238',
    ozonToHub: 'M178,348 L298,348 L298,288 L416,288',
    ymToHub:   'M168,465 L340,465 L340,308 L416,308',
    hubToD:    'M594,238 L648,238 L648,120 L700,120',
    hubToP:    'M594,263 L700,263',
    hubToE:    'M594,288 L648,288 L648,410 L700,410',
    dToB1:     'M830,108 L858,108 L858,84  L882,84',
    dToB2:     'M830,132 L858,132 L858,150 L882,150',
    pToB3:     'M830,263 L882,263',
    eToB4:     'M830,400 L858,400 L858,390 L882,390',
    eToB5:     'M830,420 L858,420 L858,436 L882,436',
    hubToAPI:    'M505,312 L505,465',
    hubToSpp:    'M594,218 L594,90 L710,90 L710,56',     // hub top-right → up → right (above card top y=98) → СПП
    shelf1ToHub: 'M310,56 L310,150 L445,150 L445,218', // left card → hub (2 bends)
    shelf2ToHub: 'M440,56 L440,130 L475,130 L475,218', // center card → hub (2 bends)
    shelf3ToHub: 'M570,56 L570,110 L520,110 L520,218', // right card → hub (2 bends)
  };

  /* ── Pro-tree paths ── */
  const proP = {
    trunk:  'M765,500 L765,520',
    left:   'M765,520 L665,548',
    center: 'M765,520 L765,548',
    right:  'M765,520 L865,548',
  };

  /* ── Traveling data packet configs ── */
  const packets = [
    { path: P.wbToHub,   c: '#8b5cf6', r: 2.5, op: 0.7,  dur: '2.5s', begin: '0s' },
    { path: P.wbToHub,   c: '#8b5cf6', r: 1.5, op: 0.35, dur: '2.5s', begin: '1.2s' },
    { path: P.ozonToHub, c: '#3b82f6', r: 2.5, op: 0.65, dur: '3s',   begin: '0.5s' },
    { path: P.ozonToHub, c: '#3b82f6', r: 1.5, op: 0.3,  dur: '3s',   begin: '2s' },
    { path: P.hubToD,    c: '#6366f1', r: 2,   op: 0.5,  dur: '2s',   begin: '0.3s' },
    { path: P.hubToP,    c: '#6366f1', r: 2,   op: 0.5,  dur: '1.2s', begin: '0.8s' },
    { path: P.hubToE,    c: '#6366f1', r: 2,   op: 0.5,  dur: '2s',   begin: '1.3s' },
    { path: P.dToB1,     c: '#0ea5e9', r: 1.5, op: 0.4,  dur: '1.5s', begin: '0.2s' },
    { path: P.dToB2,     c: '#10b981', r: 1.5, op: 0.4,  dur: '1.5s', begin: '0.7s' },
    { path: P.pToB3,     c: '#d97706', r: 1.5, op: 0.4,  dur: '1s',   begin: '0.6s' },
    { path: P.hubToAPI,  c: '#10b981', r: 2,   op: 0.5,  dur: '2.2s', begin: '0.4s' },
    { path: P.shelf1ToHub, c: '#818cf8', r: 2, op: 0.45, dur: '2.8s', begin: '0.5s' },
    { path: P.shelf2ToHub, c: '#818cf8', r: 2, op: 0.45, dur: '2.2s', begin: '1s' },
    { path: P.shelf3ToHub, c: '#818cf8', r: 2, op: 0.45, dur: '2.8s', begin: '1.5s' },
  ];

  const outY = [120, 263, 410];
  const outTexts = [o1, o2, o3];
  /* Each output: DIFFERENT CSS enter animation (fade / scale-bounce / slide-up) */
  const outAnim = ['v3-fade-in', 'v3-scale-in', 'v3-flip'];
  const outDelay = [1.5, 1.7, 1.9];

  const badgeData = [
    { x: 882, y: 70, w: 92, h: 28, fill: 'rgba(14,165,233,0.12)', stroke: 'rgba(14,165,233,0.35)', color: '#38bdf8', text: 'Telegram', anim: 'v3-float' },
    { x: 882, y: 137, w: 92, h: 28, fill: 'rgba(16,185,129,0.12)', stroke: 'rgba(16,185,129,0.35)', color: '#34d399', text: 'Webhook', anim: 'v3-blink' },
    { x: 882, y: 250, w: 78, h: 26, fill: 'rgba(217,119,6,0.12)', stroke: 'rgba(217,119,6,0.35)', color: '#fbbf24', text: roi, anim: 'v3-scale-in', dynamic: true },
    { x: 882, y: 377, w: 86, h: 28, fill: 'rgba(34,197,94,0.15)', stroke: 'rgba(34,197,94,0.4)', color: '#4ade80', text: 'Excel', anim: 'v3-flip-loop' },
    { x: 882, y: 423, w: 80, h: 28, fill: 'rgba(239,68,68,0.15)', stroke: 'rgba(239,68,68,0.4)', color: '#f87171', text: 'PDF', anim: 'v3-flip-loop v3-flip-delay' },
  ];
  const badgeDelay = [2.2, 2.3, 2.4, 2.5, 2.6];

  return (
    <section ref={sectionRef} className="data-flow-section py-16 sm:py-24 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Единая платформа аналитики
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-lg mx-auto">
              Подключите маркетплейсы — получите готовую аналитику за минуты
            </p>
          </div>
        </RevealSection>

        {/* ── Desktop diagram ── */}
        <div className="hidden sm:block relative p-6 sm:p-10 overflow-hidden">

          <svg viewBox="0 0 1000 590" className="w-full h-auto relative" fill="none">
            <defs>
              <filter id="v3-hub-shadow" x="-15%" y="-15%" width="130%" height="150%">
                <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="rgba(99,102,241,0.25)" />
              </filter>
              <linearGradient id="v3-hub-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>

            {/* ─── LINES — animated flow-dash + independent opacity pulses ─── */}
            <path d={P.shelf1ToHub} stroke="rgba(99,102,241,0.35)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.4, 300, '6 10')} />
            <path d={P.shelf2ToHub} stroke="rgba(99,102,241,0.38)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.5, 200, '6 10')} />
            <path d={P.shelf3ToHub} stroke="rgba(99,102,241,0.35)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.6, 215, '6 10')} />

            <path d={P.wbToHub} stroke="rgba(139,63,253,0.3)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.3, 350, '6 10')} />
            <path d={P.ozonToHub} stroke="rgba(37,99,235,0.3)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.5, 350, '6 10')} />
            <path d={P.ymToHub} stroke="rgba(156,163,175,0.15)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.8, 450, '6 10')} />

            <path d={P.hubToD} stroke="rgba(99,102,241,0.5)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.0, 250, '6 10')} />
            <path d={P.hubToP} stroke="rgba(99,102,241,0.5)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.2, 110, '6 10')} />
            <path d={P.hubToE} stroke="rgba(99,102,241,0.5)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.4, 250, '6 10')} />

            <path d={P.dToB1} stroke="rgba(14,165,233,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.8, 80, '6 10')} />
            <path d={P.dToB2} stroke="rgba(16,185,129,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.9, 80, '6 10')} />
            <path d={P.pToB3} stroke="rgba(217,119,6,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(2.0, 52, '6 10')} />
            <path d={P.eToB4} stroke="rgba(22,163,74,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(2.1, 80, '6 10')} />
            <path d={P.eToB5} stroke="rgba(220,38,38,0.25)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(2.2, 80, '6 10')} />
            <path d={P.hubToAPI} stroke="rgba(16,185,129,0.45)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.6, 160, '6 10')} />

            {/* ─── TRAVELING DATA PACKETS (continuous after alive) ─── */}
            {alive && packets.map((p, i) => (
              <circle key={`pkt-${i}`} r={p.r} fill={p.c} opacity={p.op}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.path} />
              </circle>
            ))}

            {/* ─── CONDITIONAL: Отчёт → green dot to Excel, Презентация → red dot to PDF ─── */}
            {alive && o3 === 'Отчёт' && (
              <circle r="1.5" fill="#16a34a" opacity="0.55">
                <animateMotion dur="1.5s" begin="0s" repeatCount="indefinite" path={P.eToB4} />
              </circle>
            )}
            {alive && o3 === 'Презентация' && (
              <circle r="1.5" fill="#dc2626" opacity="0.55">
                <animateMotion dur="1.5s" begin="0s" repeatCount="indefinite" path={P.eToB5} />
              </circle>
            )}

            {/* ═══ INTEGRATION SHELF — 3 separate animated cards (V2 labels) ═══ */}
            {shelf.map((label, i) => {
              const cx = shelfCX[i];
              const isActive = activeSlot === i;
              const cardW = 112;
              const cardH = 44;
              const rx = cx - cardW / 2;
              const ry = 12;
              return (
                <g key={`shelf-${i}`} style={show(0.3 + i * 0.12)}>
                  {/* active glow ring */}
                  {isActive && alive && (
                    <rect x={rx - 3} y={ry - 3} width={cardW + 6} height={cardH + 6} rx={16}
                      fill="none" stroke="rgba(99,102,241,0.18)" strokeWidth={2}
                      className="v3-status-pulse" />
                  )}
                  {/* card body */}
                  <rect x={rx} y={ry} width={cardW} height={cardH} rx={13}
                    fill={isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)'}
                    stroke={isActive ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.2)'}
                    strokeWidth={isActive ? 1.2 : 0.8} />
                  {/* cycling label */}
                  <text key={label} x={cx} y={ry + cardH / 2 + 4.5} textAnchor="middle"
                    fill={isActive ? '#a78bfa' : '#818cf8'}
                    fontSize={12} fontWeight={isActive ? '700' : '600'}
                    fontFamily="Inter,sans-serif"
                    opacity={isActive ? 1 : 0.6}
                    className={tick >= 0 ? 'v3-fade-in' : ''}>
                    {label}
                  </text>
                  {/* processing dot */}
                  {isActive && alive && (
                    <circle cx={rx + cardW - 10} cy={ry + 10} r={2.5}
                      fill="#6366f1" className="v3-status-pulse" />
                  )}
                </g>
              );
            })}

            {/* ═══ SOURCES (permanent) ═══ */}
            <g style={show(0)}>
              <g className={alive ? 'v3-wb-pulse' : ''}>
                <rect x="48" y="148" width="130" height="50" rx="12" fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.35)" strokeWidth="1" />
                <circle cx="76" cy="173" r="13" fill="rgba(139,63,253,0.15)" stroke="rgba(139,63,253,0.25)" strokeWidth="0.75" />
                <circle cx="76" cy="173" r="17" fill="none" stroke="rgba(139,63,253,0.2)" strokeWidth="1" strokeDasharray="4 6" className={alive ? 'v3-wb-ring' : ''} />
                <text x="76" y="177" textAnchor="middle" fill="#a78bfa" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">WB</text>
                <text x="125" y="177" textAnchor="middle" fill="#a78bfa" fontSize="11.5" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
                <circle cx="170" cy="155" r="3.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            <g style={show(0.15)}>
              <g className={alive ? 'v3-ozon-tilt' : ''}>
                <rect x="48" y="323" width="130" height="50" rx="12" fill="rgba(0,91,255,0.12)" stroke="rgba(0,91,255,0.35)" strokeWidth="1" />
                <circle cx="76" cy="348" r="13" fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="76" cy="348" r="14" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="1.5" className="v3-ozon-ring" />}
                <text x="76" y="352" textAnchor="middle" fill="#60a5fa" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">Oz</text>
                <text x="120" y="352" textAnchor="middle" fill="#60a5fa" fontSize="11.5" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
                <circle cx="170" cy="330" r="3.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            <g style={show(0.3)}>
              <g opacity="0.3">
                <rect x="55" y="447" width="113" height="36" rx="10" fill="none" stroke="rgba(156,163,175,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                <text x="111" y="470" textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif">Яндекс.Маркет</text>
              </g>
              <text x="111" y="498" textAnchor="middle" fill="#4b5563" fontSize="8" fontStyle="italic" fontFamily="Inter,sans-serif" opacity="0.6">скоро</text>
            </g>

            {/* ═══ CENTRAL HUB (permanent, hub-border spins continuously) ═══ */}
            <g style={show(0.7)}>
              <g filter="url(#v3-hub-shadow)">
                <rect x="420" y="218" width="170" height="90" rx="18" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" />
                <rect x="416" y="214" width="178" height="98" rx="22"
                  fill="none" stroke="url(#v3-hub-grad)" strokeWidth="1.5"
                  strokeDasharray="8 4" strokeOpacity="0.5" className="v3-hub-border" />
                <text x="505" y="256" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
                <text x="505" y="278" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">Analytics Hub</text>
              </g>
            </g>


            {/* ═══ OUTPUTS — each with a DIFFERENT label-change animation ═══ */}
            {outTexts.map((text, i) => (
              <g key={`out-${i}`} style={show(outDelay[i])}>
                <rect x="700" y={outY[i] - 22} width="130" height="45" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text key={text} x="765" y={outY[i] + 5} textAnchor="middle"
                  fill="white" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                  className={tick >= 0 ? outAnim[i] : ''}>
                  {text}
                </text>
              </g>
            ))}

            {/* ═══ BADGES — with icons + unique micro-animations ═══ */}
            {badgeData.map((b, i) => {
              const hasIcon = i !== 2;
              const cy = b.y + b.h / 2;
              const textX = hasIcon ? b.x + b.w / 2 + 5 : b.x + b.w / 2;
              return (
                <g key={b.dynamic ? `bdg-${i}-${b.text}` : `bdg-${i}`} style={show(badgeDelay[i])} opacity="0.85">
                  <g className={alive ? b.anim : ''}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="7" fill={b.fill} stroke={b.stroke} strokeWidth="0.75" />
                    {/* Telegram — paper plane */}
                    {i === 0 && <g transform={`translate(${b.x + 10},${cy - 4})`} opacity="0.5"><path d="M0,5 L8,0 L6,8 L4,5.5 Z" fill={b.color} /></g>}
                    {/* Webhook — lightning bolt */}
                    {i === 1 && <g transform={`translate(${b.x + 10},${cy - 5})`} opacity="0.55"><path d="M5,0 L2,5 L5,5 L3,10" stroke={b.color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g>}
                    {/* Excel — grid/table */}
                    {i === 3 && <g transform={`translate(${b.x + 8},${cy - 5})`} opacity="0.45">
                      <rect width="9" height="9" rx="1.5" stroke={b.color} strokeWidth="0.8" fill="none" />
                      <line x1="4.5" y1="0" x2="4.5" y2="9" stroke={b.color} strokeWidth="0.5" />
                      <line x1="0" y1="4.5" x2="9" y2="4.5" stroke={b.color} strokeWidth="0.5" />
                    </g>}
                    {/* PDF — document with corner fold */}
                    {i === 4 && <g transform={`translate(${b.x + 8},${cy - 5})`} opacity="0.45">
                      <path d="M0,0 L5,0 L8,3 L8,10 L0,10 Z" stroke={b.color} strokeWidth="0.8" fill="none" />
                      <path d="M5,0 L5,3 L8,3" stroke={b.color} strokeWidth="0.6" fill="none" />
                    </g>}
                    <text x={textX} y={cy + 4} textAnchor="middle"
                      fill={b.color} fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif">
                      {b.text}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* ═══ СПП — cyclic: line extends from hub → badge appears → holds 2-3s → disappears → line retracts ═══ */}
            {alive && (
              <>
                {/* Animated line: hub → СПП shelf position (draws on solid, switches to dashed, retracts) */}
                <path d={P.hubToSpp}
                  stroke="rgba(139,92,246,0.35)" strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke" fill="none"
                  strokeDasharray="280" strokeDashoffset="280">
                  <animate attributeName="stroke-dashoffset"
                    values="280;0;0;280;280"
                    keyTimes="0;0.14;0.57;0.71;1"
                    dur="7s" repeatCount="indefinite" />
                  <animate attributeName="stroke-dasharray"
                    calcMode="discrete"
                    values="280;6 10;280"
                    keyTimes="0;0.15;0.58"
                    dur="7s" repeatCount="indefinite" />
                </path>
                {/* Traveling packet on СПП line — data flows FROM СПП TO hub */}
                <circle r={2} fill="#a78bfa" opacity="0">
                  <animate attributeName="opacity"
                    values="0;0;0.6;0.6;0;0"
                    keyTimes="0;0.14;0.19;0.52;0.57;1"
                    dur="7s" repeatCount="indefinite" />
                  <animateMotion dur="2s" begin="0s" repeatCount="indefinite"
                    keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={P.hubToSpp} />
                </circle>
                {/* СПП badge — fades in after line reaches, fades out before retract */}
                <g opacity="0">
                  <animate attributeName="opacity"
                    values="0;0;1;1;0;0"
                    keyTimes="0;0.14;0.19;0.52;0.57;1"
                    dur="7s" repeatCount="indefinite" />
                  <rect x={654} y={12} width={112} height={44} rx={13}
                    fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.45)" strokeWidth={1.2} />
                  <text x={710} y={40} textAnchor="middle"
                    fill="#a78bfa" fontSize={16} fontWeight="700"
                    fontFamily="Inter,sans-serif">
                    СПП
                  </text>
                </g>
              </>
            )}

            {/* ═══ API OUTPUT (bottom branch from hub) ═══ */}
            <g style={show(2.0)}>
              <g className={alive ? 'v3-float' : ''}>
                <rect x="445" y="465" width="120" height="40" rx="10" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.35)" strokeWidth="1.2" />
                <text x="478" y="490" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="700" fontFamily="monospace">{'</>'}</text>
                <text x="528" y="490" textAnchor="middle" fill="#d1d5db" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">REST API</text>
              </g>
            </g>

            {/* ═══ PRO SUBSCRIPTION (hidden until SHOW_PRO=true) ═══ */}
            {SHOW_PRO && <>
              <g style={{ ...show(2.6), cursor: alive ? 'pointer' : 'default' }}
                 onClick={() => alive && setProActive(p => !p)}>
                <rect x={700} y={462} width={130} height={36} rx={12}
                  fill={proActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)'}
                  stroke={proActive ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={proActive ? 1.5 : 1} />
                {proActive && <rect x={698} y={460} width={134} height={40} rx={14}
                  fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth={2.5}
                  className="v3-pro-glow" />}
                <text x={765} y={485} textAnchor="middle"
                  fill={proActive ? '#fbbf24' : '#6b7280'} fontSize={11} fontWeight="700"
                  fontFamily="Inter,sans-serif">
                  {'\u26A1 PRO \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430'}
                </text>
              </g>
              {proActive && (
                <rect x={414} y={212} width={182} height={102} rx={24}
                  fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth={2}
                  className="v3-pro-glow" />
              )}
              <path d={proP.trunk} stroke="rgba(245,158,11,0.4)" strokeWidth={1.5}
                vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.05, 20)} />
              <path d={proP.left} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
                vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.15, 120)} />
              <path d={proP.center} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
                vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.15, 30)} />
              <path d={proP.right} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
                vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.2, 120)} />
              <g style={proShow(0.25)}>
                <rect x={615} y={544} width={100} height={30} rx={8}
                  fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.35)" strokeWidth={0.75} />
                <text x={665} y={563} textAnchor="middle"
                  fill="#a78bfa" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                  Монитор заказов
                </text>
              </g>
              <g style={proShow(0.35)}>
                <rect x={715} y={544} width={100} height={30} rx={8}
                  fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.35)" strokeWidth={0.75} />
                <text x={765} y={563} textAnchor="middle"
                  fill="#38bdf8" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                  Уведомления
                </text>
              </g>
              <g style={proShow(0.45)}>
                <rect x={815} y={544} width={100} height={30} rx={8}
                  fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.35)" strokeWidth={0.75} />
                <text x={865} y={563} textAnchor="middle"
                  fill="#34d399" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                  Авто-отчёты
                </text>
              </g>
              {proActive && alive && <>
                <circle r={1.5} fill="#f59e0b" opacity={0.5}>
                  <animateMotion dur="1.2s" begin="0s" repeatCount="indefinite" path={proP.left} />
                </circle>
                <circle r={1.5} fill="#f59e0b" opacity={0.5}>
                  <animateMotion dur="0.8s" begin="0.3s" repeatCount="indefinite" path={proP.center} />
                </circle>
                <circle r={1.5} fill="#f59e0b" opacity={0.5}>
                  <animateMotion dur="1.2s" begin="0.6s" repeatCount="indefinite" path={proP.right} />
                </circle>
              </>}
            </>}
          </svg>
        </div>

        {/* ── Mobile: full-featured vertical flow with all desktop elements ── */}
        <div className="sm:hidden relative p-2 overflow-hidden">
          <svg viewBox="0 0 300 450" className="w-full h-auto max-w-[340px] mx-auto relative" fill="none">
            <defs>
              <linearGradient id="v3-hub-grad-m" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <filter id="v3-hub-shadow-m" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(99,102,241,0.2)" />
              </filter>
            </defs>

            {/* ─── STAGE LINES: Sources → Shelf (draw-on + flow-dash) ─── */}
            <path d="M77,48 C77,58 52,58 52,70" stroke="rgba(139,63,253,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.3, 60, '4 8')} />
            <path d="M77,48 C77,58 150,58 150,70" stroke="rgba(139,63,253,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.4, 100, '4 8')} />
            <path d="M222,48 C222,58 150,58 150,70" stroke="rgba(37,99,235,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.4, 100, '4 8')} />
            <path d="M222,48 C222,58 248,58 248,70" stroke="rgba(37,99,235,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.3, 60, '4 8')} />

            {/* ─── STAGE LINES: Shelf → Hub ─── */}
            <path d="M52,104 C52,118 150,118 150,132" stroke="rgba(99,102,241,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(0.6, 140, '4 8')} />
            <path d="M150,104 L150,132" stroke="rgba(99,102,241,0.4)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(0.7, 30, '4 8')} />
            <path d="M248,104 C248,118 150,118 150,132" stroke="rgba(99,102,241,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(0.6, 140, '4 8')} />

            {/* ─── STAGE LINES: Hub → Outputs ─── */}
            <path d="M150,204 C150,218 52,218 52,232" stroke="rgba(99,102,241,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.0, 140, '4 8')} />
            <path d="M150,204 L150,232" stroke="rgba(99,102,241,0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.1, 30, '4 8')} />
            <path d="M150,204 C150,218 248,218 248,232" stroke="rgba(99,102,241,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.0, 140, '4 8')} />

            {/* ─── STAGE LINES: Outputs → Badges Row 1 ─── */}
            <path d="M52,264 L52,292" stroke="rgba(14,165,233,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.4, 30, '4 8')} />
            <path d="M150,264 L150,292" stroke="rgba(217,119,6,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.5, 30, '4 8')} />
            <path d="M248,264 L248,292" stroke="rgba(16,185,129,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.4, 30, '4 8')} />

            {/* ─── STAGE LINES: Badges R1 → R2 ─── */}
            <path d="M52,316 L52,330" stroke="rgba(34,197,94,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-c' : ''} {...draw(1.7, 16, '4 8')} />
            <path d="M150,316 L150,330" stroke="rgba(99,102,241,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-a' : ''} {...draw(1.8, 16, '4 8')} />
            <path d="M248,316 L248,330" stroke="rgba(220,38,38,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v4-flow-b' : ''} {...draw(1.7, 16, '4 8')} />

            {/* ─── TRAVELING DATA PACKETS ─── */}
            {alive && <>
              {/* WB → shelf */}
              <circle r={2} fill="#8b5cf6" opacity={0.7}>
                <animateMotion dur="1.8s" begin="0s" repeatCount="indefinite" path="M77,48 C77,58 52,58 52,70" />
              </circle>
              <circle r={1.5} fill="#8b5cf6" opacity={0.4}>
                <animateMotion dur="2.2s" begin="0.8s" repeatCount="indefinite" path="M77,48 C77,58 150,58 150,70" />
              </circle>
              {/* Ozon → shelf */}
              <circle r={2} fill="#3b82f6" opacity={0.7}>
                <animateMotion dur="1.8s" begin="0.3s" repeatCount="indefinite" path="M222,48 C222,58 248,58 248,70" />
              </circle>
              <circle r={1.5} fill="#3b82f6" opacity={0.4}>
                <animateMotion dur="2.2s" begin="1s" repeatCount="indefinite" path="M222,48 C222,58 150,58 150,70" />
              </circle>
              {/* Shelf → Hub */}
              <circle r={1.5} fill="#6366f1" opacity={0.55}>
                <animateMotion dur="2s" begin="0.2s" repeatCount="indefinite" path="M52,104 C52,118 150,118 150,132" />
              </circle>
              <circle r={1.5} fill="#6366f1" opacity={0.5}>
                <animateMotion dur="1.2s" begin="0.6s" repeatCount="indefinite" path="M150,104 L150,132" />
              </circle>
              <circle r={1.5} fill="#6366f1" opacity={0.55}>
                <animateMotion dur="2s" begin="1s" repeatCount="indefinite" path="M248,104 C248,118 150,118 150,132" />
              </circle>
              {/* Hub → Outputs */}
              <circle r={1.5} fill="#6366f1" opacity={0.5}>
                <animateMotion dur="2s" begin="0.1s" repeatCount="indefinite" path="M150,204 C150,218 52,218 52,232" />
              </circle>
              <circle r={1.5} fill="#6366f1" opacity={0.45}>
                <animateMotion dur="1s" begin="0.5s" repeatCount="indefinite" path="M150,204 L150,232" />
              </circle>
              <circle r={1.5} fill="#6366f1" opacity={0.5}>
                <animateMotion dur="2s" begin="0.9s" repeatCount="indefinite" path="M150,204 C150,218 248,218 248,232" />
              </circle>
            </>}

            {/* ═══ SOURCES: WB + Ozon ═══ */}
            <g style={show(0)}>
              <g className={alive ? 'v3-wb-pulse' : ''}>
                <rect x="12" y="10" width="131" height="38" rx="11" fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.35)" strokeWidth="1" />
                <circle cx="35" cy="29" r="10" fill="rgba(139,63,253,0.15)" stroke="rgba(139,63,253,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="35" cy="29" r="13" fill="none" stroke="rgba(139,63,253,0.2)" strokeWidth="1" strokeDasharray="3 5" className="v3-wb-ring" />}
                <text x="35" y="33" textAnchor="middle" fill="#a78bfa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">WB</text>
                <text x="88" y="33" textAnchor="middle" fill="#a78bfa" fontSize="10.5" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
                <circle cx="136" cy="17" r="3" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>
            <g style={show(0.12)}>
              <g className={alive ? 'v3-ozon-tilt' : ''}>
                <rect x="157" y="10" width="131" height="38" rx="11" fill="rgba(0,91,255,0.12)" stroke="rgba(0,91,255,0.35)" strokeWidth="1" />
                <circle cx="180" cy="29" r="10" fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.25)" strokeWidth="0.75" />
                {alive && <circle cx="180" cy="29" r="11" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="1" className="v3-ozon-ring" />}
                <text x="180" y="33" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">Oz</text>
                <text x="228" y="33" textAnchor="middle" fill="#60a5fa" fontSize="10.5" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
                <circle cx="281" cy="17" r="3" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            {/* ═══ SHELF: 3 cycling data-category cards ═══ */}
            {shelf.map((label, i) => {
              const cx = [52, 150, 248][i];
              const rx = [10, 108, 206][i];
              const isActive = activeSlot === i;
              return (
                <g key={`m-shelf-${i}`} style={show(0.25 + i * 0.08)}>
                  {isActive && alive && (
                    <rect x={rx - 2} y={68} width={88} height={38} rx={12}
                      fill="none" stroke="rgba(99,102,241,0.18)" strokeWidth={1.5}
                      className="v3-status-pulse" />
                  )}
                  <rect x={rx} y={70} width={84} height={34} rx={10}
                    fill={isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)'}
                    stroke={isActive ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.2)'}
                    strokeWidth={isActive ? 1 : 0.75} />
                  <text key={label} x={cx} y={91} textAnchor="middle"
                    fill={isActive ? '#a78bfa' : '#818cf8'}
                    fontSize={10} fontWeight={isActive ? '700' : '600'}
                    fontFamily="Inter,sans-serif"
                    opacity={isActive ? 1 : 0.6}
                    className={tick >= 0 ? 'v3-fade-in' : ''}>
                    {label}
                  </text>
                  {isActive && alive && (
                    <circle cx={rx + 76} cy={76} r={2} fill="#6366f1" className="v3-status-pulse" />
                  )}
                </g>
              );
            })}

            {/* ═══ PRO GOLDEN HUB GLOW (mobile, hidden until SHOW_PRO=true) ═══ */}
            {SHOW_PRO && proActive && (
              <rect x={30} y={124} width={240} height={88} rx={22}
                fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth={2}
                className="v3-pro-glow" />
            )}

            {/* ═══ CENTRAL HUB with spinning border ═══ */}
            <g style={show(0.6)}>
              <g filter="url(#v3-hub-shadow-m)">
                <rect x="38" y="132" width="224" height="72" rx="16" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" />
                <rect x="34" y="128" width="232" height="80" rx="20"
                  fill="none" stroke="url(#v3-hub-grad-m)" strokeWidth="1.5"
                  strokeDasharray="8 4" strokeOpacity="0.5" className="v3-hub-border" />
                <text x="150" y="164" textAnchor="middle" fill="white" fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
                <text x="150" y="184" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif">Analytics Hub</text>
              </g>
            </g>

            {/* ═══ 3 OUTPUT CARDS with cycling labels + different animations ═══ */}
            {outTexts.map((text, i) => {
              const cx = [52, 150, 248][i];
              const rx = [10, 108, 206][i];
              return (
                <g key={`m-out-${i}`} style={show(1.2 + i * 0.1)}>
                  <rect x={rx} y={232} width={84} height={32} rx={9}
                    fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text key={text} x={cx} y={252} textAnchor="middle"
                    fill="white" fontSize={10} fontWeight="500" fontFamily="Inter,sans-serif"
                    className={tick >= 0 ? outAnim[i] : ''}>
                    {text}
                  </text>
                </g>
              );
            })}

            {/* ═══ BADGES ROW 1: Telegram / ROI / Webhook ═══ */}
            <g style={show(1.6)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="10" y="292" width="84" height="24" rx="7" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.35)" strokeWidth="0.75" />
                <g transform="translate(22,300)" opacity="0.5"><path d="M0,4 L6,0 L5,6 L3,4.5 Z" fill="#38bdf8" /></g>
                <text x="57" y="308" textAnchor="middle" fill="#38bdf8" fontSize="8.5" fontWeight="600" fontFamily="Inter,sans-serif">Telegram</text>
              </g>
            </g>
            <g style={show(1.7)} opacity="0.85">
              <g className={alive ? 'v3-scale-in' : ''}>
                <rect x="108" y="292" width="84" height="24" rx="7" fill="rgba(217,119,6,0.12)" stroke="rgba(217,119,6,0.35)" strokeWidth="0.75" />
                <text key={`m-roi-${roi}`} x="150" y="308" textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontWeight="700" fontFamily="Inter,sans-serif">{roi}</text>
              </g>
            </g>
            <g style={show(1.65)} opacity="0.85">
              <g className={alive ? 'v3-blink' : ''}>
                <rect x="206" y="292" width="84" height="24" rx="7" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.35)" strokeWidth="0.75" />
                <g transform="translate(218,299)" opacity="0.55"><path d="M4,0 L2,4 L4,4 L2,8" stroke="#34d399" strokeWidth="1" strokeLinecap="round" fill="none" /></g>
                <text x="253" y="308" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="600" fontFamily="Inter,sans-serif">Webhook</text>
              </g>
            </g>

            {/* ═══ BADGES ROW 2: Excel / REST API / PDF ═══ */}
            <g style={show(1.85)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop' : ''}>
                <rect x="10" y="330" width="84" height="24" rx="7" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="0.75" />
                <g transform="translate(20,337)" opacity="0.45">
                  <rect width="7" height="7" rx="1" stroke="#4ade80" strokeWidth="0.7" fill="none" />
                  <line x1="3.5" y1="0" x2="3.5" y2="7" stroke="#4ade80" strokeWidth="0.4" />
                  <line x1="0" y1="3.5" x2="7" y2="3.5" stroke="#4ade80" strokeWidth="0.4" />
                </g>
                <text x="57" y="346" textAnchor="middle" fill="#4ade80" fontSize="8.5" fontWeight="600" fontFamily="Inter,sans-serif">Excel</text>
              </g>
            </g>
            <g style={show(1.9)} opacity="0.85">
              <g className={alive ? 'v3-float' : ''}>
                <rect x="108" y="330" width="84" height="24" rx="7" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.35)" strokeWidth="0.75" />
                <text x="134" y="346" textAnchor="middle" fill="#818cf8" fontSize="9" fontWeight="700" fontFamily="monospace">{'</>'}</text>
                <text x="168" y="346" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">API</text>
              </g>
            </g>
            <g style={show(1.95)} opacity="0.85">
              <g className={alive ? 'v3-flip-loop v3-flip-delay' : ''}>
                <rect x="206" y="330" width="84" height="24" rx="7" fill="rgba(220,38,38,0.15)" stroke="rgba(220,38,38,0.4)" strokeWidth="0.75" />
                <g transform="translate(216,337)" opacity="0.45">
                  <path d="M0,0 L4,0 L6,2.5 L6,8 L0,8 Z" stroke="#f87171" strokeWidth="0.7" fill="none" />
                  <path d="M4,0 L4,2.5 L6,2.5" stroke="#f87171" strokeWidth="0.5" fill="none" />
                </g>
                <text x="253" y="346" textAnchor="middle" fill="#f87171" fontSize="8.5" fontWeight="600" fontFamily="Inter,sans-serif">PDF</text>
              </g>
            </g>

            {/* ═══ PRO TOGGLE (hidden until SHOW_PRO=true) ═══ */}
            {SHOW_PRO && (
              <g style={{ ...show(2.2), cursor: alive ? 'pointer' : 'default' }}
                 onClick={() => alive && setProActive(p => !p)}>
                <rect x={68} y={372} width={164} height={30} rx={12}
                  fill={proActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)'}
                  stroke={proActive ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={proActive ? 1.5 : 1} />
                {proActive && <rect x={66} y={370} width={168} height={34} rx={14}
                  fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth={2}
                  className="v3-pro-glow" />}
                <text x={150} y={391} textAnchor="middle"
                  fill={proActive ? '#fbbf24' : '#6b7280'} fontSize={10} fontWeight="700"
                  fontFamily="Inter,sans-serif">
                  {'\u26A1 PRO \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430'}
                </text>
              </g>
            )}

            {/* ═══ YM PLACEHOLDER ═══ */}
            <g style={show(2.4)}>
              <rect x="85" y="416" width="130" height="20" rx="6" fill="none" stroke="rgba(156,163,175,0.15)" strokeWidth="0.75" strokeDasharray="3 3" />
              <text x="150" y="430" textAnchor="middle" fill="#4b5563" fontSize="8" fontFamily="Inter,sans-serif" opacity="0.6">Яндекс.Маркет · скоро</text>
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
    <section className="py-16 sm:py-20 bg-gray-50">
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
              Начните бесплатно — обновитесь, когда будете готовы.
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

function FAQItem({ question, answer, id }: { question: string; answer: string; id: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${id}`;

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        className="flex items-center justify-between w-full py-4 text-left group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-sm font-semibold text-gray-900 pr-4 group-hover:text-indigo-600 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={panelId}
        role="region"
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-4' : 'max-h-0'}`}
      >
        <div className="text-sm text-gray-600 leading-relaxed">{answer}</div>
      </div>
    </div>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: 'Как подключить маркетплейс?',
      answer:
        'После регистрации перейдите в Настройки и добавьте API-токены из личных кабинетов Wildberries и/или Ozon. Подробная инструкция будет на странице настроек.',
    },
    {
      question: 'Безопасно ли давать API-токены?',
      answer:
        'Да. Токены шифруются алгоритмом Fernet и хранятся в зашифрованном виде. Мы используем только чтение данных — никаких изменений в ваших магазинах не происходит.',
    },
    {
      question: 'Какие данные вы собираете?',
      answer:
        'Продажи, заказы, остатки на складах, удержания маркетплейсов (комиссии, логистика, хранение, штрафы) и рекламные расходы. Все данные привязаны к вашему аккаунту и доступны только вам.',
    },
    {
      question: 'Могу ли я использовать Free-тариф постоянно?',
      answer:
        'Да! Free-тариф без ограничений по времени. Он включает базовый дашборд, 1 маркетплейс (WB) и до 3 товаров.',
    },
    {
      question: 'Как отменить подписку Pro?',
      answer:
        'Подписку можно отменить в любой момент в разделе Настройки. Доступ к Pro-функциям сохранится до конца оплаченного периода.',
    },
    {
      question: 'Почему прибыль отличается от того, что в ЛК маркетплейса?',
      answer:
        'Мы рассчитываем реальную чистую прибыль с учётом ВСЕХ удержаний: комиссии, логистика, хранение, штрафы, реклама и закупочная цена. В ЛК маркетплейса показывается только часть этих данных.',
    },
  ];

  return (
    <section id="faq" className="py-16 sm:py-20 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Частые вопросы
          </h2>
        </RevealSection>
        <RevealSection className="mt-10">
          <div>
            {faqs.map((faq, i) => (
              <FAQItem key={faq.question} {...faq} id={String(i)} />
            ))}
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
   FOOTER
   ────────────────────────────────────────────── */

function FooterSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
          {/* Колонка 1 — Продукт */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Продукт</h3>
            <ul className="space-y-3">
              {(['features', 'pricing', 'security', 'faq'] as const).map((id) => (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {({ features: 'Возможности', pricing: 'Тарифы', security: 'Безопасность', faq: 'FAQ' } as const)[id]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {/* Колонка 2 — Поддержка */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Поддержка</h3>
            <ul className="space-y-3">
              <li>
                <a href="mailto:support@reviomp.ru" className="text-sm text-gray-400 hover:text-white transition-colors">
                  support@reviomp.ru
                </a>
              </li>
              <li>
                <a href="https://t.me/reviomp" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Telegram: @reviomp
                </a>
              </li>
            </ul>
          </div>
          {/* Колонка 3 — О компании */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">О компании</h3>
            <p className="text-sm text-gray-400 leading-relaxed">ИП Виноградов А.В.</p>
            <p className="text-sm text-gray-400 mt-1">ИНН&nbsp;575307312014</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              <Link to="/legal" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Соглашение</Link>
              <Link to="/policy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Оплата</Link>
              <Link to="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Конфиденциальность</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">RevioMP</span>
          </div>
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} RevioMP. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
   ────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Vertical guide lines at container edges (desktop only, Stripe-style) */}
      <div className="hidden lg:block pointer-events-none fixed inset-y-0 left-0 right-0 z-30" style={{ mixBlendMode: 'darken' }}>
        <div className="absolute left-12 top-0 bottom-0 w-px bg-gray-200" />
        <div className="absolute right-12 top-0 bottom-0 w-px bg-gray-200" />
      </div>

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
      {/* DataFlow has dark bg — no divider needed */}
      <DataFlowSectionV3 />
      <HowItWorksSection />
      <SectionDivider />
      <SecuritySection />
      <SectionDivider />
      <PricingSection />
      <SectionDivider />
      <FAQSection />
      {/* FinalCTA has gradient bg — no divider needed */}
      <FinalCTASection />
      <FooterSection />
    </div>
  );
}
