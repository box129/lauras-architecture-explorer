/**
 * Lucide icon glyph, vendored into the design system and tinted with the
 * current text color. No network dependency.
 */
export interface IconProps {
  /** kebab-case lucide name, e.g. "git-branch". Must exist in `iconGlyphs`. */
  name: string;
  /** Pixel box. Upstream sizes: 13–20 inline, 25–30 inside node icon circles. */
  size?: number;
  /** Upstream draws at 1.6–1.9; 1.75 is the house value. */
  strokeWidth?: number;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
/** name → inner SVG markup, copied verbatim from lucide-icons/lucide. */
export const iconGlyphs: Record<string, string>;
