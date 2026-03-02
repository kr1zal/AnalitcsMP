/**
 * DataFlow V4 — Enterprise data pipeline visualization.
 * 5 sources, 6 data types, central hub, 5 outputs, integrations + exports.
 * Static pills, smooth bezier curves, dot grid, RAF-driven animations.
 *
 * Self-contained: all SVG paths, pill data, packet configs are internal.
 * CSS dependencies: data-flow-section, v4-flow-*, v3-*, v4-pill-glow, v4-source-pulse-wb
 */
import { useState, useEffect, useRef } from 'react';
import { RevealSection } from '../hooks/useLandingAnimations';

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

export { DataFlowSectionV4 };
