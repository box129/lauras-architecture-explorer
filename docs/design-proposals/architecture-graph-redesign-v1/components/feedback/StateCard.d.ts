import type { ReactNode } from 'react';

/**
 * Canvas-level empty or error state.
 * @startingPoint section="Feedback" subtitle="Empty and error canvas states" viewport="700x300"
 */
export interface StateCardProps {
  /** lucide name — search-code for empty, alert-triangle for error. */
  icon?: string;
  title: string;
  message: string;
  tone?: 'neutral' | 'error';
  /** Usually a secondary Button ("Retry"). */
  action?: ReactNode;
}
export function StateCard(props: StateCardProps): JSX.Element;
