import React from 'react';
import { formatDezena } from '../lib/megasena';

export type BallVariant =
  | 'neutral'
  | 'teal'
  | 'hit'
  | 'fixed'
  | 'excluded'
  | 'hot'
  | 'cold'
  | 'delayed';

interface BallBadgeProps {
  number: number;
  variant?: BallVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BallBadgeProps['size']>, string> = {
  xs: 'w-6 h-6 text-[11px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

const VARIANT_CLASSES: Record<BallVariant, string> = {
  neutral:
    'bg-slate-100 dark:bg-[#192530] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#283847]',
  teal:
    'bg-[#208494] text-white border border-[#1B707E] shadow-xs',
  hit:
    'bg-emerald-600 text-white border border-emerald-500 shadow-xs ring-2 ring-emerald-500/25',
  fixed:
    'bg-emerald-600 text-white border border-emerald-500',
  excluded:
    'bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-400/50 line-through',
  hot:
    'bg-[#208494]/15 dark:bg-[#208494]/25 text-[#176875] dark:text-[#66D1E0] border border-[#208494]/35',
  cold:
    'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700',
  delayed:
    'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/35',
};

export const BallBadge: React.FC<BallBadgeProps> = ({
  number,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono font-semibold tabular-nums select-none shrink-0 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {formatDezena(number)}
    </span>
  );
};
