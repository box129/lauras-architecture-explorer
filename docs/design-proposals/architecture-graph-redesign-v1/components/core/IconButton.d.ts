import type { ReactNode } from 'react';

/** Square, chromeless icon button (30×30). Always needs an accessible label. */
export interface IconButtonProps {
  icon: ReactNode;
  /** Required accessible name, e.g. "Close explanation". */
  label: string;
  onClick?: () => void;
}
export function IconButton(props: IconButtonProps): JSX.Element;
