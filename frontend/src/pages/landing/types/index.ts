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
}

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  size: 'hero' | 'standard';
  visual: 'chart' | 'waterfall' | null;
  badge?: string;
}

export interface TrustBadge {
  icon: LucideIcon;
  label: string;
  sublabel: string;
}

export interface StepItem {
  number: number;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  color: 'emerald' | 'indigo' | 'violet';
}
