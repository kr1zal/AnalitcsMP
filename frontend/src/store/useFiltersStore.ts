/**
 * Zustand store для фильтров дашборда
 */
import { create } from 'zustand';
import type { DateRangePreset, FulfillmentType, Marketplace } from '../types';

interface FiltersState {
  datePreset: DateRangePreset;
  marketplace: Marketplace;
  fulfillmentType: FulfillmentType;
  customDateFrom: string | null;
  customDateTo: string | null;
  setDatePreset: (preset: DateRangePreset) => void;
  setMarketplace: (mp: Marketplace) => void;
  setFulfillmentType: (ft: FulfillmentType) => void;
  setCustomDates: (from: string, to: string) => void;
  reset: () => void;
}

const initialState = {
  datePreset: '7d' as DateRangePreset,
  marketplace: 'all' as Marketplace,
  fulfillmentType: 'all' as FulfillmentType,
  customDateFrom: null as string | null,
  customDateTo: null as string | null,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setDatePreset: (datePreset) => set({ datePreset, customDateFrom: null, customDateTo: null }),

  setMarketplace: (marketplace) => set({ marketplace }),

  setFulfillmentType: (fulfillmentType) => set({ fulfillmentType }),

  setCustomDates: (from, to) => set({ datePreset: 'custom', customDateFrom: from, customDateTo: to }),

  reset: () => set(initialState),
}));
