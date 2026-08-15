/** Light / dark / system control. System follows the OS and keeps following it. */
export interface ThemeToggleProps {
  value?: 'light' | 'dark' | 'system';
  onChange?: (value: 'light' | 'dark' | 'system') => void;
  /** compact = icons only (header) · full = icon + label (Settings). */
  variant?: 'compact' | 'full';
}
export function ThemeToggle(props: ThemeToggleProps): JSX.Element;
