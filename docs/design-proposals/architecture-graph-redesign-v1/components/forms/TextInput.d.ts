/** 38px text field, monospace by default (paths, ids, model names). */
export interface TextInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Set false for prose entry. */
  mono?: boolean;
}
export function TextInput(props: TextInputProps): JSX.Element;
