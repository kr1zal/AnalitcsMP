/**
 * Product screenshots carousel with tab navigation.
 * Rule #47: pill badge, gradient title, tab progress bar, BrowserFrame, PhoneMockup.
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { CheckCircle, Lock, Monitor, Smartphone } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { SHOWCASE_SLIDES, SHOWCASE_AUTOPLAY_MS } from '../constants/landingData';

/* ──────────────────────────────────────────────
   Frame sub-components
   ────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────
   ProductShowcase
   ────────────────────────────────────────────── */

export function ProductShowcase() {
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

        {/* Feature details — grid stacking prevents CLS (all slides in same cell, tallest wins) */}
        <div className="mt-10 sm:mt-12 max-w-4xl mx-auto">
          {/* Title + description row: grid-stacked for zero CLS */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="text-center sm:text-left min-w-0 flex-1 grid">
              {SHOWCASE_SLIDES.map((s, i) => (
                <div
                  key={s.id}
                  className={`[grid-area:1/1] transition-opacity duration-300 ${
                    i === activeIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  aria-hidden={i !== activeIndex}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{s.title}</h3>
                  <p className="mt-1.5 text-sm sm:text-[15px] text-gray-500 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>

            {/* Device toggle — always visible */}
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

          {/* Highlights row: grid-stacked for zero CLS */}
          <div className="mt-4 grid">
            {SHOWCASE_SLIDES.map((s, i) => (
              <div
                key={s.id}
                className={`[grid-area:1/1] flex flex-wrap gap-2 justify-center sm:justify-start transition-opacity duration-300 ${
                  i === activeIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={i !== activeIndex}
              >
                {s.highlights.map(h => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50/80 px-3 py-1.5 rounded-full ring-1 ring-gray-900/[0.06]"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {h}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </RevealSection>
  );
}
