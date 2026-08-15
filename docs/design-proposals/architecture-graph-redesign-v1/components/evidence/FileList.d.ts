/** Stacked list of key files with reasons. */
export interface FileListItem {
  filePath: string;
  /** Why the analysis considers this file important. */
  reason: string;
}
export interface FileListProps {
  items: FileListItem[];
  activeIndex?: number;
  onSelect?: (item: FileListItem, index: number) => void;
  emptyLabel?: string;
}
export function FileList(props: FileListProps): JSX.Element;
