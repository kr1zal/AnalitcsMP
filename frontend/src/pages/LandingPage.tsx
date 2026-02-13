/**
 * Landing page for unauthenticated users.
 * Rich visual design with Swiper carousel, scroll-reveal animations,
 * animated counters, Inter font, gradient accents.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Zap,
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

function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Revio<span className="text-indigo-600">MP</span>
            </span>
          </div>

          {/* Desktop nav — cell structure with visible borders */}
          <nav className="hidden md:flex items-center h-full border-l border-gray-200">
            {[
              { label: 'Возможности', id: 'features' },
              { label: 'Тарифы', id: 'pricing' },
              { label: 'Безопасность', id: 'security' },
              { label: 'FAQ', id: 'faq' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-5 h-full flex items-center border-r border-gray-200 hover:bg-white hover:shadow-[0_2px_12px_rgba(0,0,0,0.1)] hover:z-10 transition-all duration-200"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center h-full">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-5 h-full flex items-center border-x border-gray-200 hover:bg-white hover:shadow-[0_2px_12px_rgba(0,0,0,0.1)] hover:z-10 transition-all duration-200"
            >
              Войти
            </Link>
            <Link
              to="/login?signup=1"
              className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50 ml-4"
            >
              Начать бесплатно
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-4 space-y-1 animate-fade-in">
          {[
            { label: 'Возможности', id: 'features' },
            { label: 'Тарифы', id: 'pricing' },
            { label: 'Безопасность', id: 'security' },
            { label: 'FAQ', id: 'faq' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="block w-full text-left text-sm text-gray-700 hover:text-indigo-600 py-2.5 px-2 rounded-lg hover:bg-indigo-50/50 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <hr className="border-gray-100 my-2" />
          <Link to="/login" className="block text-sm text-gray-700 py-2.5 px-2">
            Войти
          </Link>
          <Link
            to="/login?signup=1"
            className="block text-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 rounded-xl transition-colors"
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
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 via-white to-white" />

      {/* Matrix digital rain animation */}
      <MatrixRain />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-indigo-700">
            WB + Ozon в одном дашборде
          </span>
        </div>

        <h1 className="animate-fade-up delay-100 text-[42px] sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight max-w-4xl mx-auto">
          <span className="text-gray-900">Прозрачная аналитика </span>
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            для маркетплейсов
          </span>
        </h1>

        <p className="animate-fade-up delay-200 mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Выручка, прибыль, удержания, реклама и&nbsp;остатки — в&nbsp;реальном
          времени. Без&nbsp;Excel и&nbsp;ручных расчётов.
        </p>

        <div className="animate-fade-up delay-300 mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login?signup=1"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50"
          >
            Начать бесплатно
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-sm text-gray-500">Бесплатно навсегда. Без привязки карты.</p>
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
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">PostgreSQL</span>
      </div>
      <div key={`${prefix}-rest`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">REST API</span>
      </div>
      <div key={`${prefix}-ssl`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <ShieldCheck className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">SSL / TLS</span>
      </div>
      <div key={`${prefix}-fernet`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Fernet</span>
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
   DASHBOARD CAROUSEL (Swiper)
   ────────────────────────────────────────────── */

/** Slide 1 – Main dashboard overview */
function SlideDashboard() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs">
            reviomp.ru
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Дашборд — Обзор</h3>
          <span className="text-xs text-gray-400">01 — 31 янв 2026</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Продажи', value: '124,567 ₽', color: 'from-indigo-500 to-indigo-600', change: '+12.5%', positive: true },
            { label: 'Прибыль', value: '34,890 ₽', color: 'from-emerald-500 to-emerald-600', change: '+8.2%', positive: true },
            { label: 'ДРР', value: '5.4%', color: 'from-amber-500 to-amber-600', change: '-1.2%', positive: true },
            { label: 'Реклама', value: '6,780 ₽', color: 'from-blue-500 to-blue-600', change: '+3.1%', positive: false },
          ].map((card) => (
            <div key={card.label} className="rounded-xl p-3 sm:p-4 bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <p className={`text-lg sm:text-xl font-bold mt-1 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                {card.value}
              </p>
              <p className={`text-xs font-medium mt-1 ${card.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                {card.change} к пред.
              </p>
            </div>
          ))}
        </div>
        {/* Bar chart */}
        <div className="mt-4 bg-gray-50 rounded-xl border border-gray-100 h-28 sm:h-36 flex items-end px-4 pb-3 gap-1">
          {[35, 48, 30, 55, 70, 45, 75, 60, 85, 65, 80, 92, 50, 68].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500 to-indigo-400 opacity-80 hover:opacity-100 transition-opacity"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Slide 2 – Costs tree */
function SlideCostsTree() {
  const rows = [
    { label: 'Комиссия МП', wb: '12,340 ₽', ozon: '8,920 ₽', icon: PieChart },
    { label: 'Логистика', wb: '5,670 ₽', ozon: '4,110 ₽', icon: RefreshCw },
    { label: 'Хранение', wb: '2,890 ₽', ozon: '1,560 ₽', icon: ClipboardList },
    { label: 'Штрафы', wb: '340 ₽', ozon: '0 ₽', icon: Zap },
    { label: 'Реклама', wb: '3,450 ₽', ozon: '2,120 ₽', icon: Megaphone },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs">
            reviomp.ru/dashboard
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Дерево удержаний</h3>
          <div className="flex gap-2">
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">WB</span>
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">Ozon</span>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{row.label}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-sm font-semibold text-purple-700">{row.wb}</span>
                  <span className="text-sm font-semibold text-blue-600">{row.ozon}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between py-3 px-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <span className="text-sm font-semibold text-gray-900">Итого удержания</span>
          <span className="text-sm font-bold text-indigo-700">41,400 ₽</span>
        </div>
      </div>
    </div>
  );
}

/** Slide 3 – Sales chart */
function SlideSalesChart() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs">
            reviomp.ru/dashboard
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Динамика продаж</h3>
          <span className="text-xs text-gray-400">за 30 дней</span>
        </div>
        {/* Line chart mockup */}
        <div className="relative h-40 sm:h-48 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden p-4">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-dashed border-gray-200" style={{ top: `${25 * i + 12}%` }} />
          ))}
          {/* WB line mockup */}
          <svg className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]" viewBox="0 0 300 120" fill="none" preserveAspectRatio="none">
            <path
              d="M0,90 C20,80 40,60 60,65 C80,70 100,40 120,35 C140,30 160,50 180,45 C200,40 220,25 240,20 C260,15 280,30 300,10"
              stroke="url(#wb-gradient)"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M0,90 C20,80 40,60 60,65 C80,70 100,40 120,35 C140,30 160,50 180,45 C200,40 220,25 240,20 C260,15 280,30 300,10 L300,120 L0,120Z"
              fill="url(#wb-fill)"
              opacity="0.15"
            />
            <path
              d="M0,100 C20,95 40,85 60,88 C80,90 100,70 120,72 C140,75 160,60 180,65 C200,68 220,55 240,50 C260,48 280,60 300,45"
              stroke="url(#ozon-gradient)"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M0,100 C20,95 40,85 60,88 C80,90 100,70 120,72 C140,75 160,60 180,65 C200,68 220,55 240,50 C260,48 280,60 300,45 L300,120 L0,120Z"
              fill="url(#ozon-fill)"
              opacity="0.1"
            />
            <defs>
              <linearGradient id="wb-gradient" x1="0" x2="300" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B3FFD" />
                <stop offset="1" stopColor="#A855F7" />
              </linearGradient>
              <linearGradient id="wb-fill" x1="0" x2="0" y1="0" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B3FFD" />
                <stop offset="1" stopColor="#8B3FFD" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ozon-gradient" x1="0" x2="300" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#005BFF" />
                <stop offset="1" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="ozon-fill" x1="0" x2="0" y1="0" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#005BFF" />
                <stop offset="1" stopColor="#005BFF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-purple-500 to-purple-600" />
            <span className="text-xs font-medium text-gray-600">Wildberries</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-500 to-blue-600" />
            <span className="text-xs font-medium text-gray-600">Ozon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCarousel() {
  return (
    <RevealSection className="mt-14 sm:mt-20 max-w-4xl mx-auto px-4 sm:px-6">
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{ clickable: true }}
        autoplay={{ delay: 5000, disableOnInteraction: true }}
        spaceBetween={24}
        slidesPerView={1}
        className="landing-swiper !pb-10"
      >
        <SwiperSlide><SlideDashboard /></SwiperSlide>
        <SwiperSlide><SlideCostsTree /></SwiperSlide>
        <SwiperSlide><SlideSalesChart /></SwiperSlide>
      </Swiper>
    </RevealSection>
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
              { value: 2, suffix: '', label: 'Маркетплейса', extra: 'WB + Ozon' },
              { value: 6, suffix: '+', label: 'Типов отчётов', extra: 'Продажи, удержания...' },
              { value: 4, suffix: 'x', label: 'Синхронизация', extra: 'В день (Pro)' },
              { value: 990, suffix: ' ₽', label: 'Pro тариф', extra: 'В месяц' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.extra}</p>
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
   DATA FLOW ANIMATION (Stripe-inspired)
   ────────────────────────────────────────────── */

function DataFlowSection() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCycle((c) => (c + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, []);

  const inputLabels = [
    ['Продажи', 'Заказы', 'Выкупы'],
    ['Остатки', 'FBO', 'Склады'],
    ['Реклама', 'Удержания', 'Комиссия'],
  ];
  const outputLabels = [
    ['Дашборд', 'Графики', 'Тренды'],
    ['Прибыль', 'Маржа', 'ROI'],
    ['Отчёт', 'PDF', 'Экспорт'],
  ];

  const rowY = [78, 210, 342];

  const lines = [
    // WB → input labels
    'M140,153 C190,153 190,78 225,78',       // 0: WB → top
    'M140,153 C190,153 190,210 225,210',      // 1: WB → mid
    // Ozon → input labels
    'M140,267 C190,267 190,210 225,210',      // 2: Ozon → mid
    'M140,267 C190,267 190,342 225,342',      // 3: Ozon → bottom
    // Input labels → hub
    'M345,78 C395,78 395,210 420,210',        // 4: top → hub
    'M345,210 L420,210',                       // 5: mid → hub
    'M345,342 C395,342 395,210 420,210',      // 6: bottom → hub
    // Hub → output labels
    'M580,210 C630,210 630,78 655,78',        // 7: hub → top out
    'M580,210 L655,210',                       // 8: hub → mid out
    'M580,210 C630,210 630,342 655,342',      // 9: hub → bottom out
    // Export branches (Экспорт → Excel / PDF)
    'M775,332 C800,332 810,310 830,310',      // 10: → Excel
    'M775,352 C800,352 810,374 830,374',      // 11: → PDF
  ];

  const packets = [
    { path: lines[0], dur: '2.5s', begin: '0s' },     // WB → top
    { path: lines[1], dur: '2.8s', begin: '0.4s' },   // WB → mid
    { path: lines[2], dur: '2.8s', begin: '0.6s' },   // Ozon → mid
    { path: lines[3], dur: '3s', begin: '0.5s' },     // Ozon → bottom
    { path: lines[4], dur: '2s', begin: '0.8s' },     // top → hub
    { path: lines[5], dur: '1.8s', begin: '1s' },     // mid → hub
    { path: lines[6], dur: '2.5s', begin: '1.5s' },   // bottom → hub
    { path: lines[7], dur: '2s', begin: '0.3s' },     // hub → top out
    { path: lines[8], dur: '1.8s', begin: '0.7s' },   // hub → mid out
    { path: lines[9], dur: '2.5s', begin: '1s' },     // hub → bottom out
    { path: lines[10], dur: '1.5s', begin: '0.2s' },  // → Excel
    { path: lines[11], dur: '1.5s', begin: '0.9s' },  // → PDF
  ];

  return (
    <section className="data-flow-section py-16 sm:py-24 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Как работают ваши данные
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-lg mx-auto">
              Автоматический сбор, обработка и визуализация — в реальном времени
            </p>
          </div>
        </RevealSection>

        <RevealSection delay={200}>
          {/* Desktop: full SVG diagram */}
          <div className="hidden sm:block relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="data-flow-grid absolute inset-0 rounded-2xl" />
            <svg
              viewBox="0 0 960 420"
              className="w-full h-auto relative"
              fill="none"
            >
              {/* Connection lines */}
              {lines.map((d, i) => (
                <path key={`ln-${i}`} d={d} className="flow-line" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
              ))}

              {/* Traveling data packets */}
              {packets.map((p, i) => (
                <circle key={`pk-${i}`} r="3" fill="#818cf8" opacity="0.8">
                  <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.path} />
                </circle>
              ))}

              {/* Source: Wildberries */}
              <rect x="30" y="130" width="110" height="46" rx="10"
                fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.35)" strokeWidth="1" />
              <text x="85" y="158" textAnchor="middle"
                fill="#A78BFA" fontSize="13" fontWeight="600" fontFamily="Inter,sans-serif">
                Wildberries
              </text>

              {/* Source: Ozon */}
              <rect x="30" y="244" width="110" height="46" rx="10"
                fill="rgba(0,91,255,0.12)" stroke="rgba(0,91,255,0.35)" strokeWidth="1" />
              <text x="85" y="272" textAnchor="middle"
                fill="#60A5FA" fontSize="13" fontWeight="600" fontFamily="Inter,sans-serif">
                Ozon
              </text>

              {/* Input labels (cycling) */}
              {inputLabels.map((variants, idx) => {
                const label = variants[(cycle + idx) % 3];
                return (
                  <g key={`in-${idx}`}>
                    <rect x="225" y={rowY[idx] - 20} width="120" height="40" rx="8"
                      fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <text
                      key={label}
                      x="285" y={rowY[idx] + 5} textAnchor="middle"
                      fill="white" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                      className="flow-label-enter"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Central hub */}
              <rect x="420" y="165" width="160" height="90" rx="16"
                fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"
                className="flow-hub-rect" />
              <text x="500" y="205" textAnchor="middle"
                fill="white" fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">
                RevioMP
              </text>
              <text x="500" y="225" textAnchor="middle"
                fill="rgba(255,255,255,0.6)" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">
                Analytics
              </text>

              {/* Output labels (cycling) */}
              {outputLabels.map((variants, idx) => {
                const label = variants[(cycle + idx) % 3];
                return (
                  <g key={`out-${idx}`}>
                    <rect x="655" y={rowY[idx] - 20} width="120" height="40" rx="8"
                      fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <text
                      key={label}
                      x="715" y={rowY[idx] + 5} textAnchor="middle"
                      fill="white" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                      className="flow-label-enter"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Export format badges — alternating pulse */}
              <g>
                <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.45;0.5;1" dur="2s" repeatCount="indefinite" />
                <rect x="830" y="296" width="80" height="28" rx="6"
                  fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
                <text x="870" y="314" textAnchor="middle"
                  fill="#4ade80" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">
                  Excel
                </text>
              </g>
              <g>
                <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.45;0.5;1" dur="2s" repeatCount="indefinite" />
                <rect x="830" y="360" width="80" height="28" rx="6"
                  fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.4)" strokeWidth="1" />
                <text x="870" y="378" textAnchor="middle"
                  fill="#f87171" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">
                  PDF
                </text>
              </g>
            </svg>
          </div>

          {/* Mobile: animated vertical SVG flow */}
          <div className="sm:hidden relative rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="data-flow-grid absolute inset-0 rounded-2xl" />
            <svg viewBox="0 0 280 440" className="w-full h-auto relative max-w-[320px] mx-auto" fill="none">
              {/* Lines */}
              {[
                'M80,58 C80,85 140,85 140,112',
                'M200,58 C200,85 140,85 140,112',
                'M140,148 L140,195',
                'M140,265 L140,302',
                'M140,338 C140,370 75,370 75,394',
                'M140,338 C140,370 205,370 205,394',
              ].map((d, i) => (
                <g key={`ml-${i}`}>
                  <path d={d} className="flow-line" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                  <circle r="2.5" fill="#818cf8" opacity="0.8">
                    <animateMotion dur={`${2 + i * 0.4}s`} begin={`${i * 0.3}s`} repeatCount="indefinite" path={d} />
                  </circle>
                </g>
              ))}

              {/* WB */}
              <rect x="30" y="22" width="100" height="36" rx="8"
                fill="rgba(139,63,253,0.12)" stroke="rgba(139,63,253,0.35)" strokeWidth="1" />
              <text x="80" y="45" textAnchor="middle"
                fill="#A78BFA" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">WB</text>

              {/* Ozon */}
              <rect x="150" y="22" width="100" height="36" rx="8"
                fill="rgba(0,91,255,0.12)" stroke="rgba(0,91,255,0.35)" strokeWidth="1" />
              <text x="200" y="45" textAnchor="middle"
                fill="#60A5FA" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>

              {/* Input cycling label */}
              <rect x="85" y="112" width="110" height="36" rx="8"
                fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text key={inputLabels[0][cycle % 3]} x="140" y="135" textAnchor="middle"
                fill="white" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif"
                className="flow-label-enter">
                {inputLabels[0][cycle % 3]}
              </text>

              {/* Hub */}
              <rect x="60" y="195" width="160" height="70" rx="14"
                fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"
                className="flow-hub-rect" />
              <text x="140" y="226" textAnchor="middle"
                fill="white" fontSize="14" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>

              {/* Output cycling label */}
              <rect x="85" y="302" width="110" height="36" rx="8"
                fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text key={outputLabels[0][cycle % 3]} x="140" y="325" textAnchor="middle"
                fill="white" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif"
                className="flow-label-enter">
                {outputLabels[0][cycle % 3]}
              </text>

              {/* Bottom outputs */}
              <rect x="30" y="394" width="90" height="32" rx="8"
                fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text key={outputLabels[1][cycle % 3]} x="75" y="414" textAnchor="middle"
                fill="white" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif"
                className="flow-label-enter">
                {outputLabels[1][cycle % 3]}
              </text>

              <rect x="160" y="394" width="90" height="32" rx="8"
                fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text key={outputLabels[2][cycle % 3]} x="205" y="414" textAnchor="middle"
                fill="white" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif"
                className="flow-label-enter">
                {outputLabels[2][cycle % 3]}
              </text>
            </svg>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   DATAFLOW V2 — COMPARISON PROTOTYPE (delete after review)
   All proposed features:
   1. Third source: "Рекламные API"
   2. Telegram + API output badges
   3. Pulsing hub + floating badges (AES-128, 30 мин)
   4. Micro-metrics flying along paths (₽, +12%, 5 SKU)
   5. Excel/PDF badges (same as V1)
   ────────────────────────────────────────────── */

function DataFlowSectionV2() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCycle((c) => (c + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, []);

  const inputLabels = [
    ['Продажи', 'Заказы', 'Выкупы'],
    ['Остатки', 'FBO', 'Склады'],
    ['Реклама', 'Удержания', 'Комиссия'],
  ];
  const outputLabels = [
    ['Дашборд', 'Графики', 'Дашборд'],
    ['Прибыль', 'Маржа', 'ROI'],
    ['Отчёт', 'PDF', 'Экспорт'],
  ];

  const rowY = [78, 210, 342];

  const lines = [
    // WB → все 3 входа
    'M140,153 C190,153 190,78 225,78',       // 0: WB → Продажи
    'M140,153 C190,153 190,210 225,210',      // 1: WB → Остатки
    'M140,153 C190,153 190,342 225,342',      // 2: WB → Реклама
    // Ozon → все 3 входа
    'M140,267 C190,267 190,78 225,78',        // 3: Ozon → Продажи
    'M140,267 C190,267 190,210 225,210',      // 4: Ozon → Остатки
    'M140,267 C190,267 190,342 225,342',      // 5: Ozon → Реклама
    // Входы → хаб
    'M345,78 C395,78 395,210 420,210',        // 6: top → hub
    'M345,210 L420,210',                       // 7: mid → hub
    'M345,342 C395,342 395,210 420,210',      // 8: bottom → hub
    // Хаб → выходы
    'M580,210 C630,210 630,78 655,78',        // 9: hub → Дашборд
    'M580,210 L655,210',                       // 10: hub → Прибыль
    'M580,210 C630,210 630,342 655,342',      // 11: hub → Экспорт
    // Ветки от Дашборд
    'M775,68 C800,68 810,48 830,48',          // 12: → Telegram
    'M775,88 C800,88 810,108 830,108',        // 13: → Webhook
    // Ветка от Прибыль
    'M775,210 L830,210',                       // 14: → ROI
    // Ветки от Экспорт
    'M775,330 C800,330 810,300 830,300',      // 15: → Excel
    'M775,342 L830,342',                       // 16: → REST API
    'M775,354 C800,354 810,384 830,384',      // 17: → PDF
  ];

  const packets = [
    // WB → входы (фиолетовые)
    { path: lines[0], dur: '2.5s', begin: '0s', fill: '#7c3aed' },
    { path: lines[1], dur: '2.8s', begin: '0.7s', fill: '#7c3aed' },
    { path: lines[2], dur: '3.2s', begin: '1.4s', fill: '#7c3aed' },
    // Ozon → входы (синие)
    { path: lines[3], dur: '3s', begin: '0.3s', fill: '#2563eb' },
    { path: lines[4], dur: '2.6s', begin: '1s', fill: '#2563eb' },
    { path: lines[5], dur: '3s', begin: '1.8s', fill: '#2563eb' },
    // Входы → хаб (индиго)
    { path: lines[6], dur: '2s', begin: '0.8s', fill: '#6366f1' },
    { path: lines[7], dur: '1.8s', begin: '1.2s', fill: '#6366f1' },
    { path: lines[8], dur: '2.5s', begin: '1.6s', fill: '#6366f1' },
    // Хаб → выходы
    { path: lines[9], dur: '2s', begin: '0.3s', fill: '#16a34a' },
    { path: lines[10], dur: '1.8s', begin: '0.7s', fill: '#d97706' },
    { path: lines[11], dur: '2.5s', begin: '1.1s', fill: '#6366f1' },
    // Ветки
    { path: lines[12], dur: '1.5s', begin: '0.5s', fill: '#16a34a' },
    { path: lines[13], dur: '1.5s', begin: '0.8s', fill: '#16a34a' },
    { path: lines[14], dur: '1.2s', begin: '0.3s', fill: '#d97706' },
    { path: lines[15], dur: '1.5s', begin: '0.2s', fill: '#16a34a' },
    { path: lines[16], dur: '1.2s', begin: '0.7s', fill: '#6366f1' },
    { path: lines[17], dur: '1.5s', begin: '0.9s', fill: '#dc2626' },
  ];

  // Микро-метрики — какие данные летят по каждой цепочке
  const metrics = [
    // WB данные (фиолетовые)
    { text: '5 SKU',  path: lines[0], dur: '4s', begin: '0s', fill: '#7c3aed' },
    { text: 'FBO',    path: lines[1], dur: '4s', begin: '1.5s', fill: '#7c3aed' },
    { text: 'CPM',    path: lines[2], dur: '4.5s', begin: '3s', fill: '#7c3aed' },
    // Ozon данные (синие)
    { text: '3 SKU',  path: lines[3], dur: '4s', begin: '0.8s', fill: '#2563eb' },
    { text: 'FBO',    path: lines[4], dur: '4s', begin: '2.2s', fill: '#2563eb' },
    { text: 'ДРР',    path: lines[5], dur: '4.5s', begin: '3.5s', fill: '#2563eb' },
    // Выходные метрики
    { text: '+12%',   path: lines[9], dur: '3.5s', begin: '1s', fill: '#16a34a' },
    { text: '₽',      path: lines[10], dur: '3s', begin: '0.5s', fill: '#d97706' },
    { text: '−3.2%',  path: lines[11], dur: '3.5s', begin: '2s', fill: '#dc2626' },
  ];

  return (
    <section className="py-16 sm:py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 mb-4">
              V2 — СРАВНЕНИЕ (удалить после ревью)
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Как работают ваши данные
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-lg mx-auto">
              Автоматический сбор, обработка и визуализация — в реальном времени
            </p>
          </div>
        </RevealSection>

        <RevealSection delay={200}>
          <div className="hidden sm:block relative rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
            {/* Light dot grid */}
            <div className="absolute inset-0 rounded-2xl" style={{
              backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
            <svg
              viewBox="0 0 960 420"
              className="w-full h-auto relative"
              fill="none"
            >
              {/* [A+G] Connection lines — animated dash + variable width */}
              {lines.map((d, i) => {
                const w = i <= 5 ? 1.2 : i <= 8 ? 1.8 : i <= 11 ? 2 : 1.2;
                const alpha = i <= 5 ? 0.18 : i <= 8 ? 0.22 : i <= 11 ? 0.28 : 0.15;
                return (
                  <path key={`ln-${i}`} d={d} className="flow-line"
                    stroke={`rgba(99,102,241,${alpha})`} strokeWidth={w} />
                );
              })}

              {/* [B] Traveling data packets — color-coded by source */}
              {packets.map((p, i) => (
                <circle key={`pk-${i}`} r="3.5" fill={p.fill} opacity="0.7">
                  <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.path} />
                </circle>
              ))}

              {/* Micro-metrics flying along paths */}
              {metrics.map((m, i) => (
                <text key={`mt-${i}`} fontSize="9" fill={m.fill} fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.85">
                  {m.text}
                  <animateMotion dur={m.dur} begin={m.begin} repeatCount="indefinite" path={m.path} />
                </text>
              ))}

              {/* Source: Wildberries */}
              <rect x="30" y="130" width="110" height="46" rx="10"
                fill="rgba(139,63,253,0.08)" stroke="rgba(139,63,253,0.25)" strokeWidth="1" />
              <text x="85" y="158" textAnchor="middle"
                fill="#7c3aed" fontSize="13" fontWeight="600" fontFamily="Inter,sans-serif">
                Wildberries
              </text>
              {/* [E] Status dot — connected */}
              <circle cx="132" cy="138" r="3.5" fill="#22c55e">
                <animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Source: Ozon */}
              <rect x="30" y="244" width="110" height="46" rx="10"
                fill="rgba(37,99,235,0.08)" stroke="rgba(37,99,235,0.25)" strokeWidth="1" />
              <text x="85" y="272" textAnchor="middle"
                fill="#2563eb" fontSize="13" fontWeight="600" fontFamily="Inter,sans-serif">
                Ozon
              </text>
              {/* [E] Status dot — connected */}
              <circle cx="132" cy="252" r="3.5" fill="#22c55e">
                <animate attributeName="r" values="3;4.5;3" dur="2s" begin="0.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin="0.5s" repeatCount="indefinite" />
              </circle>

              {/* Input labels (cycling) */}
              {inputLabels.map((variants, idx) => {
                const label = variants[(cycle + idx) % 3];
                return (
                  <g key={`in-${idx}`}>
                    <rect x="225" y={rowY[idx] - 20} width="120" height="40" rx="8"
                      fill="white" stroke="#e5e7eb" strokeWidth="1" />
                    <text
                      key={label}
                      x="285" y={rowY[idx] + 5} textAnchor="middle"
                      fill="#1f2937" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                      className="flow-label-enter"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* [F] Pulsing central hub with processing spinners */}
              <g className="flow-hub-pulse">
                <rect x="420" y="165" width="160" height="90" rx="16"
                  fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                {/* Glow ring */}
                <rect x="414" y="159" width="172" height="102" rx="20"
                  fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="3">
                  <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" />
                </rect>
                {/* Dual counter-rotating processing arcs */}
                <circle cx="500" cy="210" r="56" fill="none"
                  stroke="rgba(99,102,241,0.15)" strokeWidth="1.5"
                  strokeDasharray="25 327" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate"
                    values="0 500 210;360 500 210" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle cx="500" cy="210" r="56" fill="none"
                  stroke="rgba(99,102,241,0.1)" strokeWidth="1.5"
                  strokeDasharray="15 337" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate"
                    values="360 500 210;0 500 210" dur="5s" repeatCount="indefinite" />
                </circle>
                <text x="500" y="205" textAnchor="middle"
                  fill="#312e81" fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">
                  RevioMP
                </text>
                <text x="500" y="225" textAnchor="middle"
                  fill="#6366f1" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">
                  Analytics
                </text>
              </g>

              {/* Floating badges around hub — faster pulse */}
              <g>
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
                <rect x="395" y="138" width="62" height="20" rx="10"
                  fill="rgba(22,163,74,0.08)" stroke="rgba(22,163,74,0.25)" strokeWidth="0.5" />
                <text x="426" y="152" textAnchor="middle"
                  fill="#16a34a" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">
                  AES-128
                </text>
              </g>
              <g>
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin="0.7s" repeatCount="indefinite" />
                <rect x="543" y="262" width="56" height="20" rx="10"
                  fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.2)" strokeWidth="0.5" />
                <text x="571" y="276" textAnchor="middle"
                  fill="#4f46e5" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif">
                  30 мин
                </text>
              </g>
              <g>
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin="1.3s" repeatCount="indefinite" />
                <rect x="543" y="138" width="44" height="20" rx="10"
                  fill="rgba(139,63,253,0.08)" stroke="rgba(139,63,253,0.2)" strokeWidth="0.5" />
                <text x="565" y="152" textAnchor="middle"
                  fill="#7c3aed" fontSize="9">
                  🔒
                </text>
              </g>

              {/* Output labels (cycling) */}
              {outputLabels.map((variants, idx) => {
                const label = variants[(cycle + idx) % 3];
                return (
                  <g key={`out-${idx}`}>
                    <rect x="655" y={rowY[idx] - 20} width="120" height="40" rx="8"
                      fill="white" stroke="#e5e7eb" strokeWidth="1" />
                    <text
                      key={label}
                      x="715" y={rowY[idx] + 5} textAnchor="middle"
                      fill="#1f2937" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                      className="flow-label-enter"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* ─── Output badges ─── */}

              {/* Telegram — от Дашборд */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
                <rect x="830" y="34" width="90" height="28" rx="6"
                  fill="rgba(14,165,233,0.08)" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
                <text x="875" y="52" textAnchor="middle"
                  fill="#0284c7" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">
                  Telegram
                </text>
              </g>

              {/* [H] Webhook — от Дашборд */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
                <rect x="830" y="94" width="90" height="28" rx="6"
                  fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
                <text x="875" y="112" textAnchor="middle"
                  fill="#059669" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">
                  Webhook
                </text>
              </g>

              {/* [C] ROI badge — от Прибыль */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
                <rect x="830" y="196" width="80" height="28" rx="6"
                  fill="rgba(217,119,6,0.08)" stroke="rgba(217,119,6,0.3)" strokeWidth="1" />
                <text x="870" y="214" textAnchor="middle"
                  fill="#d97706" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">
                  +42% ROI
                </text>
              </g>

              {/* Excel — от Экспорт */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin="0.1s" repeatCount="indefinite" />
                <rect x="830" y="286" width="80" height="28" rx="6"
                  fill="rgba(22,163,74,0.08)" stroke="rgba(22,163,74,0.3)" strokeWidth="1" />
                <text x="870" y="304" textAnchor="middle"
                  fill="#16a34a" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">
                  Excel
                </text>
              </g>

              {/* REST API — от Экспорт */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
                <rect x="830" y="328" width="80" height="28" rx="6"
                  fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.3)" strokeWidth="1" />
                <text x="870" y="346" textAnchor="middle"
                  fill="#7c3aed" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">
                  REST API
                </text>
              </g>

              {/* PDF — от Экспорт */}
              <g>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin="0.75s" repeatCount="indefinite" />
                <rect x="830" y="370" width="80" height="28" rx="6"
                  fill="rgba(220,38,38,0.08)" stroke="rgba(220,38,38,0.3)" strokeWidth="1" />
                <text x="870" y="388" textAnchor="middle"
                  fill="#dc2626" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">
                  PDF
                </text>
              </g>
            </svg>
          </div>

          {/* Mobile: skip for comparison */}
          <div className="sm:hidden text-center text-gray-400 text-sm py-8">
            V2 comparison — desktop only
          </div>
        </RevealSection>
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
    transformBox: 'fill-box' as any,
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
    ymToHub:   'M168,465 L258,465 L258,308 L416,308',
    hubToD:    'M594,238 L648,238 L648,120 L700,120',
    hubToP:    'M594,263 L700,263',
    hubToE:    'M594,288 L648,288 L648,410 L700,410',
    dToB1:     'M830,108 L858,108 L858,84  L882,84',
    dToB2:     'M830,132 L858,132 L858,150 L882,150',
    pToB3:     'M830,263 L882,263',
    eToB4:     'M830,400 L858,400 L858,390 L882,390',
    eToB5:     'M830,420 L858,420 L858,436 L882,436',
    hubToAPI:  'M505,312 L505,465',
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
  ];

  const outY = [120, 263, 410];
  const outTexts = [o1, o2, o3];
  /* Each output: DIFFERENT CSS enter animation (fade / scale-bounce / slide-up) */
  const outAnim = ['v3-fade-in', 'v3-scale-in', 'v3-flip'];
  const outDelay = [1.5, 1.7, 1.9];

  const badgeData = [
    { x: 882, y: 70, w: 85, h: 26, fill: 'rgba(14,165,233,0.06)', stroke: 'rgba(14,165,233,0.22)', color: '#0284c7', text: 'Telegram', anim: 'v3-float' },
    { x: 882, y: 137, w: 85, h: 26, fill: 'rgba(16,185,129,0.06)', stroke: 'rgba(16,185,129,0.22)', color: '#059669', text: 'Webhook', anim: 'v3-blink' },
    { x: 882, y: 250, w: 78, h: 26, fill: 'rgba(217,119,6,0.06)', stroke: 'rgba(217,119,6,0.22)', color: '#d97706', text: roi, anim: 'v3-scale-in', dynamic: true },
    { x: 882, y: 377, w: 78, h: 26, fill: 'rgba(22,163,74,0.06)', stroke: 'rgba(22,163,74,0.22)', color: '#16a34a', text: 'Excel', anim: 'v3-flip-loop' },
    { x: 882, y: 423, w: 78, h: 26, fill: 'rgba(220,38,38,0.06)', stroke: 'rgba(220,38,38,0.22)', color: '#dc2626', text: 'PDF', anim: 'v3-flip-loop v3-flip-delay' },
  ];
  const badgeDelay = [2.2, 2.3, 2.4, 2.5, 2.6];

  return (
    <section ref={sectionRef} className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 mb-4">
              V3 — LIVING ECOSYSTEM
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Единая платформа аналитики
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-lg mx-auto">
              Подключите маркетплейсы — получите готовую аналитику за минуты
            </p>
          </div>
        </RevealSection>

        {/* ── Desktop diagram ── */}
        <div className="hidden sm:block relative rounded-2xl border border-gray-100 bg-[#fafbfc] p-6 sm:p-10 overflow-hidden">
          <div className="absolute inset-0 rounded-2xl v3-dot-grid" />

          <svg viewBox="0 0 1000 590" className="w-full h-auto relative" fill="none">
            <defs>
              <filter id="v3-hub-shadow" x="-15%" y="-15%" width="130%" height="150%">
                <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="rgba(99,102,241,0.10)" />
              </filter>
              <linearGradient id="v3-hub-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>

            {/* ─── LINES — varied dash patterns + independent opacity pulses ─── */}
            <path d={P.wbToHub} stroke="rgba(139,63,253,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-a' : ''} {...draw(0.3, 350, '2 4')} />
            <path d={P.ozonToHub} stroke="rgba(37,99,235,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-b' : ''} {...draw(0.5, 350, '6 3')} />
            <path d={P.ymToHub} stroke="rgba(156,163,175,0.12)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-c' : ''} {...draw(0.8, 450, '4 4')} />

            <path d={P.hubToD} stroke="rgba(99,102,241,0.45)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-c' : ''} {...draw(1.0, 250, '1 3')} />
            <path d={P.hubToP} stroke="rgba(99,102,241,0.45)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-a' : ''} {...draw(1.2, 110, '1 3')} />
            <path d={P.hubToE} stroke="rgba(99,102,241,0.45)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-b' : ''} {...draw(1.4, 250, '1 3')} />

            <path d={P.dToB1} stroke="rgba(14,165,233,0.15)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-b' : ''} {...draw(1.8, 80, '2 3')} />
            <path d={P.dToB2} stroke="rgba(16,185,129,0.15)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-c' : ''} {...draw(1.9, 80, '2 3')} />
            <path d={P.pToB3} stroke="rgba(217,119,6,0.15)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-a' : ''} {...draw(2.0, 52, '2 3')} />
            <path d={P.eToB4} stroke="rgba(22,163,74,0.15)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-c' : ''} {...draw(2.1, 80, '2 3')} />
            <path d={P.eToB5} stroke="rgba(220,38,38,0.15)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-b' : ''} {...draw(2.2, 80, '2 3')} />
            <path d={P.hubToAPI} stroke="rgba(16,185,129,0.40)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" className={alive ? 'v3-line-a' : ''} {...draw(1.6, 160, '3 5')} />

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

            {/* ═══ SOURCES (permanent) ═══ */}
            <g style={show(0)}>
              <g className={alive ? 'v3-wb-pulse' : ''}>
                <rect x="48" y="148" width="130" height="50" rx="12" fill="white" stroke="rgba(139,63,253,0.25)" strokeWidth="1" />
                <circle cx="76" cy="173" r="13" fill="rgba(139,63,253,0.08)" stroke="rgba(139,63,253,0.2)" strokeWidth="0.75" />
                <circle cx="76" cy="173" r="17" fill="none" stroke="rgba(139,63,253,0.15)" strokeWidth="1" strokeDasharray="4 6" className={alive ? 'v3-wb-ring' : ''} />
                <text x="76" y="177" textAnchor="middle" fill="#7c3aed" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">WB</text>
                <text x="125" y="177" textAnchor="middle" fill="#374151" fontSize="11.5" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
                <circle cx="170" cy="155" r="3.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            <g style={show(0.15)}>
              <g className={alive ? 'v3-ozon-tilt' : ''}>
                <rect x="48" y="323" width="130" height="50" rx="12" fill="white" stroke="rgba(37,99,235,0.25)" strokeWidth="1" />
                <circle cx="76" cy="348" r="13" fill="rgba(37,99,235,0.08)" stroke="rgba(37,99,235,0.2)" strokeWidth="0.75" />
                {alive && <circle cx="76" cy="348" r="14" fill="none" stroke="rgba(37,99,235,0.2)" strokeWidth="1.5" className="v3-ozon-ring" />}
                <text x="76" y="352" textAnchor="middle" fill="#2563eb" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">Oz</text>
                <text x="120" y="352" textAnchor="middle" fill="#374151" fontSize="11.5" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
                <circle cx="170" cy="330" r="3.5" fill="#22c55e" className="v3-status-pulse" />
              </g>
            </g>

            <g style={show(0.3)}>
              <g opacity="0.35">
                <rect x="55" y="447" width="113" height="36" rx="10" fill="none" stroke="rgba(156,163,175,0.5)" strokeWidth="1" strokeDasharray="4 4" />
                <text x="111" y="470" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif">Яндекс.Маркет</text>
              </g>
              <text x="111" y="498" textAnchor="middle" fill="#d1d5db" fontSize="8" fontStyle="italic" fontFamily="Inter,sans-serif" opacity="0.6">скоро</text>
            </g>

            {/* ═══ CENTRAL HUB (permanent, hub-border spins continuously) ═══ */}
            <g style={show(0.7)}>
              <g filter="url(#v3-hub-shadow)">
                <rect x="420" y="218" width="170" height="90" rx="18" fill="white" stroke="rgba(99,102,241,0.18)" strokeWidth="1.5" />
                <rect x="416" y="214" width="178" height="98" rx="22"
                  fill="none" stroke="url(#v3-hub-grad)" strokeWidth="1.5"
                  strokeDasharray="8 4" strokeOpacity="0.4" className="v3-hub-border" />
                <text x="505" y="256" textAnchor="middle" fill="#1e1b4b" fontSize="16" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
                <text x="505" y="278" textAnchor="middle" fill="#6366f1" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">Analytics Hub</text>
              </g>
            </g>


            {/* ═══ OUTPUTS — each with a DIFFERENT label-change animation ═══ */}
            {outTexts.map((text, i) => (
              <g key={`out-${i}`} style={show(outDelay[i])}>
                <rect x="700" y={outY[i] - 22} width="130" height="45" rx="10" fill="white" stroke="#e5e7eb" strokeWidth="1" />
                <text key={text} x="765" y={outY[i] + 5} textAnchor="middle"
                  fill="#1f2937" fontSize="12" fontWeight="500" fontFamily="Inter,sans-serif"
                  className={tick >= 0 ? outAnim[i] : ''}>
                  {text}
                </text>
              </g>
            ))}

            {/* ═══ BADGES — each with a UNIQUE micro-animation ═══ */}
            {badgeData.map((b, i) => (
              <g key={b.dynamic ? `bdg-${i}-${b.text}` : `bdg-${i}`} style={show(badgeDelay[i])} opacity="0.85">
                <g className={alive ? b.anim : ''}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill={b.fill} stroke={b.stroke} strokeWidth="0.75" />
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle"
                    fill={b.color} fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif">
                    {b.text}
                  </text>
                </g>
              </g>
            ))}

            {/* ═══ API OUTPUT (bottom branch from hub) ═══ */}
            <g style={show(2.0)}>
              <g className={alive ? 'v3-float' : ''}>
                <rect x="445" y="465" width="120" height="40" rx="10" fill="white" stroke="rgba(16,185,129,0.3)" strokeWidth="1.2" />
                <text x="478" y="490" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="700" fontFamily="monospace">{'</>'}</text>
                <text x="528" y="490" textAnchor="middle" fill="#374151" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">REST API</text>
              </g>
            </g>

            {/* ═══ PRO SUBSCRIPTION TOGGLE ═══ */}
            <g style={{ ...show(2.6), cursor: alive ? 'pointer' : 'default' }}
               onClick={() => alive && setProActive(p => !p)}>
              <rect x={700} y={462} width={130} height={36} rx={12}
                fill={proActive ? 'rgba(245,158,11,0.06)' : 'white'}
                stroke={proActive ? 'rgba(245,158,11,0.45)' : 'rgba(209,213,219,0.6)'}
                strokeWidth={proActive ? 1.5 : 1} />
              {proActive && <rect x={698} y={460} width={134} height={40} rx={14}
                fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth={2.5}
                className="v3-pro-glow" />}
              <text x={765} y={485} textAnchor="middle"
                fill={proActive ? '#b45309' : '#9ca3af'} fontSize={11} fontWeight="700"
                fontFamily="Inter,sans-serif">
                {'\u26A1 PRO \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430'}
              </text>
            </g>

            {/* ═══ PRO GOLDEN HUB GLOW (when active) ═══ */}
            {proActive && (
              <rect x={414} y={212} width={182} height={102} rx={24}
                fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth={2}
                className="v3-pro-glow" />
            )}

            {/* ═══ PRO TREE — trunk + branches ═══ */}
            <path d={proP.trunk} stroke="rgba(245,158,11,0.4)" strokeWidth={1.5}
              vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.05, 20)} />
            <path d={proP.left} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.15, 120)} />
            <path d={proP.center} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.15, 30)} />
            <path d={proP.right} stroke="rgba(245,158,11,0.3)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" fill="none" {...proDraw(0.2, 120)} />

            {/* ═══ PRO FEATURE NODES ═══ */}
            <g style={proShow(0.25)}>
              <rect x={615} y={544} width={100} height={30} rx={8}
                fill="rgba(139,92,246,0.05)" stroke="rgba(139,92,246,0.22)" strokeWidth={0.75} />
              <text x={665} y={563} textAnchor="middle"
                fill="#7c3aed" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                Монитор заказов
              </text>
            </g>

            <g style={proShow(0.35)}>
              <rect x={715} y={544} width={100} height={30} rx={8}
                fill="rgba(14,165,233,0.05)" stroke="rgba(14,165,233,0.22)" strokeWidth={0.75} />
              <text x={765} y={563} textAnchor="middle"
                fill="#0284c7" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                Уведомления
              </text>
            </g>

            <g style={proShow(0.45)}>
              <rect x={815} y={544} width={100} height={30} rx={8}
                fill="rgba(16,185,129,0.05)" stroke="rgba(16,185,129,0.22)" strokeWidth={0.75} />
              <text x={865} y={563} textAnchor="middle"
                fill="#059669" fontSize={9.5} fontWeight="600" fontFamily="Inter,sans-serif">
                Авто-отчёты
              </text>
            </g>

            {/* Pro traveling dots */}
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
          </svg>
        </div>

        {/* ── Mobile: simplified with traveling dots + cycling labels ── */}
        <div className="sm:hidden relative rounded-2xl border border-gray-100 bg-[#fafbfc] p-4 overflow-hidden">
          <div className="absolute inset-0 rounded-2xl v3-dot-grid" />
          <svg viewBox="0 0 300 400" className="w-full h-auto max-w-[320px] mx-auto relative" fill="none">
            <defs>
              <linearGradient id="v3-hub-grad-m" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>

            {/* Lines */}
            <path d="M90,66 L90,95 L150,120" stroke="rgba(139,63,253,0.2)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" className={alive ? 'v3-line-a' : ''} />
            <path d="M210,66 L210,95 L150,120" stroke="rgba(37,99,235,0.2)" strokeWidth="1" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" className={alive ? 'v3-line-b' : ''} />
            <path d="M150,195 L150,230" stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" className={alive ? 'v3-line-c' : ''} />

            {/* Mobile traveling dots */}
            {alive && <>
              <circle r="2" fill="#8b5cf6" opacity="0.6">
                <animateMotion dur="2s" begin="0s" repeatCount="indefinite" path="M90,66 L90,95 L150,120" />
              </circle>
              <circle r="2" fill="#3b82f6" opacity="0.6">
                <animateMotion dur="2.5s" begin="0.5s" repeatCount="indefinite" path="M210,66 L210,95 L150,120" />
              </circle>
              <circle r="2" fill="#6366f1" opacity="0.5">
                <animateMotion dur="1.5s" begin="0.3s" repeatCount="indefinite" path="M150,195 L150,230" />
              </circle>
            </>}

            {/* Sources */}
            <rect x="30" y="26" width="120" height="40" rx="10" fill="white" stroke="rgba(139,63,253,0.25)" strokeWidth="1" />
            <text x="90" y="51" textAnchor="middle" fill="#374151" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Wildberries</text>
            <circle cx="142" cy="33" r="3" fill="#22c55e" className="v3-status-pulse" />

            <rect x="150" y="26" width="120" height="40" rx="10" fill="white" stroke="rgba(37,99,235,0.25)" strokeWidth="1" />
            <text x="210" y="51" textAnchor="middle" fill="#374151" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Ozon</text>
            <circle cx="262" cy="33" r="3" fill="#22c55e" className="v3-status-pulse" />

            {/* Hub */}
            <rect x="55" y="120" width="190" height="75" rx="16" fill="white" stroke="rgba(99,102,241,0.18)" strokeWidth="1.5" />
            <rect x="51" y="116" width="198" height="83" rx="20"
              fill="none" stroke="url(#v3-hub-grad-m)" strokeWidth="1.5"
              strokeDasharray="8 4" strokeOpacity="0.4" className="v3-hub-border" />
            <text x="150" y="155" textAnchor="middle" fill="#1e1b4b" fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">RevioMP</text>
            <text x="150" y="175" textAnchor="middle" fill="#6366f1" fontSize="10" fontWeight="500" fontFamily="Inter,sans-serif">Analytics Hub</text>

            {/* Output with cycling label */}
            <rect x="55" y="230" width="190" height="55" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="1" />
            <text key={o1} x="150" y="256" textAnchor="middle" fill="#1f2937" fontSize="13" fontWeight="500" fontFamily="Inter,sans-serif"
              className={tick >= 0 ? 'v3-fade-in' : ''}>
              {o1}
            </text>
            <text key={`sub-${o2}-${o3}`} x="150" y="274" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Inter,sans-serif"
              className={tick >= 0 ? 'v3-slide-up' : ''}>
              {o2} · {o3}
            </text>

            {/* Bottom badges */}
            <rect x="15" y="310" width="130" height="30" rx="8" fill="white" stroke="rgba(22,163,74,0.2)" strokeWidth="1" />
            <text x="80" y="330" textAnchor="middle" fill="#16a34a" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Excel · PDF</text>

            <rect x="155" y="310" width="130" height="30" rx="8" fill="white" stroke="rgba(14,165,233,0.2)" strokeWidth="1" />
            <g className={alive ? 'v3-float' : ''}>
              <text x="220" y="330" textAnchor="middle" fill="#0284c7" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Telegram</text>
            </g>

            {/* YM placeholder */}
            <rect x="85" y="355" width="130" height="22" rx="6" fill="none" stroke="rgba(156,163,175,0.25)" strokeWidth="0.75" strokeDasharray="3 3" />
            <text x="150" y="370" textAnchor="middle" fill="#d1d5db" fontSize="8" fontFamily="Inter,sans-serif">Яндекс.Маркет · скоро</text>
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

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <RevealSection>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow h-full">
              <h3 className="text-lg font-bold text-gray-900">Free</h3>
              <p className="text-sm text-gray-500 mt-1">Для старта</p>
              <div className="mt-5">
                <span className="text-4xl font-extrabold text-gray-900">0 ₽</span>
                <span className="text-sm text-gray-500 ml-1.5">навсегда</span>
              </div>
              <Link
                to="/login?signup=1"
                className="mt-6 block text-center px-4 py-3 border border-gray-300 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                Начать бесплатно
              </Link>
              <ul className="mt-6 space-y-3">
                {['Дашборд с ключевыми метриками', 'Wildberries', 'До 3 SKU', 'Синхронизация 2 раза/день'].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </RevealSection>

          {/* Pro */}
          <RevealSection delay={100}>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border-2 border-indigo-600 p-6 relative hover:shadow-xl hover:shadow-indigo-100 transition-shadow h-full">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-md">
                Рекомендуем
              </div>
              <h3 className="text-lg font-bold text-gray-900">Pro</h3>
              <p className="text-sm text-gray-500 mt-1">Для растущего бизнеса</p>
              <div className="mt-5">
                <span className="text-4xl font-extrabold text-gray-900">990 ₽</span>
                <span className="text-sm text-gray-500 ml-1.5">/мес</span>
              </div>
              <Link
                to="/login?signup=1"
                className="mt-6 block text-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200/50"
              >
                Начать бесплатно
              </Link>
              <ul className="mt-6 space-y-3">
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
                    className={`flex items-start gap-2.5 text-sm ${f.highlight ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}
                  >
                    {!f.highlight && <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
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

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        className="flex items-center justify-between w-full py-4 text-left group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-gray-900 pr-4 group-hover:text-indigo-600 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 pb-4' : 'max-h-0'}`}
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
            {faqs.map((faq) => (
              <FAQItem key={faq.question} {...faq} />
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
            Подключите маркетплейсы за 2 минуты и увидьте реальную картину бизнеса.
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
  return (
    <footer className="py-10 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">
              Revio<span className="text-indigo-400">MP</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="mailto:support@reviomp.ru" className="hover:text-white transition-colors">
              support@reviomp.ru
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} RevioMP. Все права защищены.
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   MOBILE STICKY CTA
   ────────────────────────────────────────────── */

function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 safe-area-bottom">
        <Link
          to="/login?signup=1"
          className="flex items-center justify-center gap-2 w-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 py-3 rounded-xl shadow-lg shadow-indigo-200/50 transition-all"
        >
          Начать бесплатно
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
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
      <DashboardCarousel />
      <SectionDivider />
      <StatsBar />
      <SectionDivider />
      <ProblemSection />
      <SectionDivider />
      <FeaturesSection />
      {/* DataFlow has dark bg — no divider needed */}
      <DataFlowSection />
      {/* V2 COMPARISON — delete after review */}
      <DataFlowSectionV2 />
      {/* V3 HUB-SPOKE — Stripe-inspired comparison */}
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
      <MobileStickyCta />
    </div>
  );
}
