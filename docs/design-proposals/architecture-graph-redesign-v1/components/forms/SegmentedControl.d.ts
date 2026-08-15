/**
 * Pill segments with an uppercase field label.
 * @startingPoint section="Forms" subtitle="Advanced-settings segment rows" viewport="700x160"
 */
export interface SegmentedOption {
  value: string;
  label: string;
  /** Shown as a native tooltip — used upstream to explain each analysis mode. */
  description?: string;
}
export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  /** Uppercase 11px field label above the row. */
  label?: string;
}
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
