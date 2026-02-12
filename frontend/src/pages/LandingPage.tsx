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
    'M140,153 C190,153 190,78 225,78',
    'M140,153 C190,153 190,210 225,210',
    // Ozon → input labels
    'M140,267 C190,267 190,210 225,210',
    'M140,267 C190,267 190,342 225,342',
    // Input labels → hub
    'M345,78 C395,78 395,210 420,210',
    'M345,210 L420,210',
    'M345,342 C395,342 395,210 420,210',
    // Hub → output labels
    'M580,210 C630,210 630,78 655,78',
    'M580,210 L655,210',
    'M580,210 C630,210 630,342 655,342',
  ];

  const packets = [
    { path: lines[0], dur: '2.5s', begin: '0s' },
    { path: lines[3], dur: '3s', begin: '0.5s' },
    { path: lines[4], dur: '2s', begin: '0.8s' },
    { path: lines[6], dur: '2.5s', begin: '1.5s' },
    { path: lines[7], dur: '2s', begin: '0.3s' },
    { path: lines[9], dur: '2.5s', begin: '1s' },
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
