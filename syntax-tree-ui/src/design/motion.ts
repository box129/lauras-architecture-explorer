export const observatoryEase = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const observatoryDurations = {
  micro: 120,
  layout: 280,
  surface: 520,
} as const;

export const observatoryMotion = {
  ease: observatoryEase,
  durations: observatoryDurations,
  transition: {
    micro: `${observatoryDurations.micro}ms ${observatoryEase}`,
    layout: `${observatoryDurations.layout}ms ${observatoryEase}`,
    surface: `${observatoryDurations.surface}ms ${observatoryEase}`,
  },
} as const;
