/**
 * Landing page TypeScript types.
 */
import type { LucideIcon } from 'lucide-react';

export interface ShowcaseSlideData {
  id: string;
  tab: string;
  icon: LucideIcon;
  title: string;
  description: string;
  highlights: string[];
  desktop: string;
  mobile: string;
}

export interface Testimonial {
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

export interface PricingFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
}

export interface StatItem {
  value: string;
  label: string;
  detail: string;
}

export interface ProblemCard {
  number: string;
  unit: string;
  subtitle: string;
  description: string;
  accentColor: string;
  bgColor: string;
  /** Gradient start for top accent bar, e.g. 'from-red-400' */
  gradientFrom?: string;
  /** Gradient end for top accent bar, e.g. 'to-red-600' */
  gradientTo?: string;
  /** Gradient classes for number text, e.g. 'from-red-500 to-red-600' */
  numberGradient?: string;
}

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  badge?: string;
  /** Hero cards get animated content in bento grid */
  heroType?: 'sync-timeline' | 'profit-reveal';
}

export interface TrustBadge {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  color: 'emerald' | 'sky' | 'violet' | 'indigo' | 'amber';
}

export interface StepItem {
  number: number;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  color: 'emerald' | 'indigo' | 'violet';
}
