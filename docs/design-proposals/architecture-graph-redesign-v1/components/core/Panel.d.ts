import type { ReactNode } from 'react';

/** Paper surface with a 1px stone border and a 12px radius. */
export interface PanelProps {
  padding?: number | string;
  /** Use over the map canvas so the wash shows through. */
  translucent?: boolean;
  elevation?: 'none' | 'node' | 'card' | 'panel';
  children?: ReactNode;
}
export function Panel(props: PanelProps): JSX.Element;
