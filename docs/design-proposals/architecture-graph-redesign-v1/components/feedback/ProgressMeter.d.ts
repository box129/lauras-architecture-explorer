/** Determinate progress bar for file parsing. */
export interface ProgressMeterProps {
  label?: string;
  value?: number;
  total?: number;
  /** Current file path, monospace and single-line. */
  caption?: string;
}
export function ProgressMeter(props: ProgressMeterProps): JSX.Element;
