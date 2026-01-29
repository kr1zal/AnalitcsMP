/**
 * Zustand store для фильтров дашборда
 */
import { create } from 'zustand';
import type { DateRangePreset, Marketplace } from '../types';

interface FiltersState {
  datePreset: DateRangePreset;
  marketplace: Marketplace;
  customDateFrom: string | null;
  customDateTo: string | null;
  setDatePreset: (preset: DateRangePreset) => void;
  setMarketplace: (mp: Marketplace) => void;
  setCustomDates: (from: string, to: string) => void;
  reset: () => void;
}

const initialState = {
  datePreset: '7d' as DateRangePreset,
  marketplace: 'all' as Marketplace,
  customDateFrom: null as string | null,
  customDateTo: null as string | null,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setDatePreset: (datePreset) => set({ datePreset, customDateFrom: null, customDateTo: null }),

  setMarketplace: (marketplace) => set({ marketplace }),

  setCustomDates: (from, to) => set({ datePreset: 'custom', customDateFrom: from, customDateTo: to }),

  reset: () => set(initialState),
}));
