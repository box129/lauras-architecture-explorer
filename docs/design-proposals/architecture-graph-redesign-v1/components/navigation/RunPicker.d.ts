/** Run provenance control for the top bar's right slot. */
export interface RunPickerProps {
  /** Full run id, e.g. "run:1f7f34f034dc4674a8f395f29adb58ee". Shown abbreviated. */
  runId: string;
  /** The prominent human label, e.g. "active run" or "scanned 4m ago". */
  lastScanned?: string;
  /** Secondary freshness selector label. */
  freshness?: string;
  onCopy?: (runId: string) => void;
}
export function RunPicker(props: RunPickerProps): JSX.Element;
