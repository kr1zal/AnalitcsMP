/**
 * useFilterUrlSync — двусторонняя синхронизация фильтров Zustand ↔ URL query params.
 *
 * URL params:
 *   period = 7d | 30d | 90d | custom
 *   mp     = all | wb | ozon
 *   ft     = all | FBO | FBS
 *   from   = YYYY-MM-DD  (только при period=custom)
 *   to     = YYYY-MM-DD  (только при period=custom)
 *
 * Дефолтные значения (7d, all, all) НЕ пишутся в URL — чистый адрес.
 * replaceState (не pushState) — не засоряет browser history при смене фильтров.
 * Чужие query params (utm_source, ref и т.д.) сохраняются.
 */
import { useEffect, useRef } from 'react';
import { useFiltersStore } from '../store/useFiltersStore';
import type { DateRangePreset, FulfillmentType, Marketplace } from '../types';

const VALID_PRESETS: Set<DateRangePreset> = new Set(['7d', '30d', '90d', 'custom']);
const VALID_MP: Set<Marketplace> = new Set(['all', 'wb', 'ozon']);
const VALID_FT: Set<FulfillmentType> = new Set(['all', 'FBO', 'FBS']);

/** Ключи, которыми управляет этот хук — чужие params не трогаем */
const FILTER_KEYS = ['period', 'mp', 'ft', 'from', 'to'] as const;

const DEFAULTS = {
  period: '7d' as DateRangePreset,
  mp: 'all' as Marketplace,
  ft: 'all' as FulfillmentType,
};

/** YYYY-MM-DD format check */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function useFilterUrlSync() {
  const isInitialized = useRef(false);
  const isUpdatingFromUrl = useRef(false);

  const {
    datePreset,
    marketplace,
    fulfillmentType,
    customDateFrom,
    customDateTo,
    setDatePreset,
    setMarketplace,
    setFulfillmentType,
    setCustomDates,
  } = useFiltersStore();

  // ── Phase 1: URL → Zustand (mount only) ──
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlPeriod = params.get('period');
    const urlMp = params.get('mp');
    const urlFt = params.get('ft');
    const urlFrom = params.get('from');
    const urlTo = params.get('to');

    // Nothing in URL → keep Zustand defaults, skip
    if (!urlPeriod && !urlMp && !urlFt && !urlFrom && !urlTo) return;

    isUpdatingFromUrl.current = true;

    // Marketplace
    if (urlMp && VALID_MP.has(urlMp as Marketplace)) {
      setMarketplace(urlMp as Marketplace);
    }

    // Fulfillment type
    if (urlFt && VALID_FT.has(urlFt as FulfillmentType)) {
      setFulfillmentType(urlFt as FulfillmentType);
    }

    // Period + custom dates
    if (urlPeriod === 'custom' && urlFrom && urlTo && isValidDate(urlFrom) && isValidDate(urlTo)) {
      setCustomDates(urlFrom, urlTo);
    } else if (urlPeriod && VALID_PRESETS.has(urlPeriod as DateRangePreset) && urlPeriod !== 'custom') {
      setDatePreset(urlPeriod as DateRangePreset);
    }

    // queueMicrotask — executes before next render, no cleanup needed (unlike rAF)
    queueMicrotask(() => {
      isUpdatingFromUrl.current = false;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: read URL once

  // ── Phase 2: Zustand → URL (on every filter change) ──
  useEffect(() => {
    // Skip during URL→Zustand initialization
    if (isUpdatingFromUrl.current) return;
    // Skip before init (first render)
    if (!isInitialized.current) return;

    // Preserve foreign query params (utm_source, ref, etc.)
    const params = new URLSearchParams(window.location.search);
    FILTER_KEYS.forEach((k) => params.delete(k));

    // Only write non-default values
    if (datePreset !== DEFAULTS.period) {
      params.set('period', datePreset);
    }
    if (marketplace !== DEFAULTS.mp) {
      params.set('mp', marketplace);
    }
    if (fulfillmentType !== DEFAULTS.ft) {
      params.set('ft', fulfillmentType);
    }
    if (datePreset === 'custom' && customDateFrom && customDateTo) {
      params.set('from', customDateFrom);
      params.set('to', customDateTo);
    }

    const search = params.toString();
    const newUrl = search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname;

    // replaceState to avoid polluting browser history
    window.history.replaceState(null, '', newUrl);
  }, [datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo]);
}
