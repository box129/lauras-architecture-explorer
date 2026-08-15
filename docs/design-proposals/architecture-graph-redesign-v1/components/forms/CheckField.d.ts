import type { ReactNode } from 'react';

/** Checkbox + inline label, slate accent. */
export interface CheckFieldProps {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
}
export function CheckField(props: CheckFieldProps): JSX.Element;
