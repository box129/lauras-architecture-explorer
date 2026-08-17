/** Top-bar navigation trail; the last item is the current location. */
export interface BreadcrumbItem {
  id: string | null;
  label: string;
  title?: string;
}
export interface BreadcrumbTrailProps {
  items: BreadcrumbItem[];
  /** Omit to render a static (non-clickable) trail. */
  onSelect?: (index: number) => void;
}
export function BreadcrumbTrail(props: BreadcrumbTrailProps): JSX.Element;
