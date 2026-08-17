/** One row in the analysis-progress stage grid. */
export interface StageRowProps {
  state?: 'done' | 'current' | 'waiting' | 'failed' | 'skipped';
  /** Human stage copy, e.g. "Building the code graph" — never the raw pipeline id. */
  label: string;
  /** Blocking error or warnings, surfaced as a tooltip. */
  title?: string;
}
export function StageRow(props: StageRowProps): JSX.Element;
