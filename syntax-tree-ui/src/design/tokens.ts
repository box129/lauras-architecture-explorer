export const observatoryColors = {
  canvas: '#F8F5F1',
  paper: '#FCFAF7',
  ink: '#1A1916',
  stone: '#8F8A82',
  border: '#DED8CF',
  slateBlue: '#3D5A80',
  citrine: '#C9A227',
  clay: '#A0522D',
  sage: '#7A9B68',
  mutedRed: '#B45C4A',
  white: '#FFFFFF',
} as const;

export const observatoryTypography = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", "Fira Code", ui-monospace, SFMono-Regular, monospace',
} as const;

export const observatoryLayout = {
  topBarHeight: 48,
  voiceRailWidth: 360,
  questionDockWidth: 720,
  nodeRadius: 10,
} as const;

export type ObservatoryColorName = keyof typeof observatoryColors;
