import type { Product } from '../../../types';

export interface CCConflict {
  wbProduct: Product;
  ozonProduct: Product;
}

export interface LinkedPair {
  pairId: string; // groupId or product.id for auto-linked
  wb: Product;
  ozon: Product;
  isAutoLinked: boolean;
}

export interface ImportPricesResponse {
  status: string;
  updated: number;
  total_rows: number;
  skipped: number;
  not_found: string[];
  errors: string[];
}
