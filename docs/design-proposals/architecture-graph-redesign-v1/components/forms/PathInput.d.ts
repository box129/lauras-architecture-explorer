/**
 * The entry screen's repository-path field.
 * @startingPoint section="Forms" subtitle="Path field with Browse escape hatch" viewport="700x150"
 */
export interface PathInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Omit to hide the Browse button; manual entry always stays available. */
  onBrowse?: () => void;
  browseLabel?: string;
}
export function PathInput(props: PathInputProps): JSX.Element;
