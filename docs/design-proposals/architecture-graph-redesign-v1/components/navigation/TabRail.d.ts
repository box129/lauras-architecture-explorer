/**
 * Segmented tab strip used for the voice rail's explanation modes.
 * @startingPoint section="Navigation" subtitle="Simple / technical / evidence rail tabs" viewport="700x150"
 */
export interface TabRailProps {
  /** Lowercase tab ids; rendered capitalized. */
  tabs?: string[];
  value: string;
  onChange?: (tab: string) => void;
}
export function TabRail(props: TabRailProps): JSX.Element;
