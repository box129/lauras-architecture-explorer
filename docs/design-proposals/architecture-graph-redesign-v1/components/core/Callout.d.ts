import type { ReactNode } from 'react';

/** Inline note stating a limitation, gap or recovery path. */
export interface CalloutProps {
  /** warning = clay, the default for gaps · unsupported = muted red · success = sage. */
  tone?: 'warning' | 'unsupported' | 'success';
  /** Usually a StatusBadge or an Icon. */
  icon?: ReactNode;
  children?: ReactNode;
}
export function Callout(props: CalloutProps): JSX.Element;
