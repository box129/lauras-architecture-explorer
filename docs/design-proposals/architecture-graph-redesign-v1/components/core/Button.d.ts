import type { ReactNode } from 'react';

/**
 * Syntax Tree text button.
 * @startingPoint section="Core" subtitle="Primary, quiet, secondary and pill buttons" viewport="700x180"
 */
export interface ButtonProps {
  /** primary = slate-blue solid (one per screen); quiet = slate tint used in the voice rail; secondary = paper card button; pill = rounded stone outline (recent paths, filters). */
  variant?: 'primary' | 'quiet' | 'secondary' | 'pill';
  /** sm 28px · md 32px · lg 48px (the entry screen's "Build architecture map"). */
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconAfter?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}
export function Button(props: ButtonProps): JSX.Element;
