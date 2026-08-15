import type { ReactNode } from 'react';

/** Small informational pill. */
export interface ChipProps {
  /** fact = neutral metadata · clay = status word · slate = mode/state · signal = detected framework · measure = dashed, for map-confidence numbers. */
  tone?: 'fact' | 'clay' | 'slate' | 'signal' | 'measure';
  icon?: ReactNode;
  children?: ReactNode;
  title?: string;
}
export function Chip(props: ChipProps): JSX.Element;
