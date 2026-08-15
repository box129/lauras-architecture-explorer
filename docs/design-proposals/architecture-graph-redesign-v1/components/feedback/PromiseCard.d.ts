/** One of the three promises on the entry screen. */
export interface PromiseCardProps {
  /** lucide name; upstream uses shield-check, git-branch, clock. */
  icon?: string;
  title: string;
  text: string;
}
export function PromiseCard(props: PromiseCardProps): JSX.Element;
