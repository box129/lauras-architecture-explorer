import { observatoryColors } from './tokens';

export type EvidenceStatus =
  | 'verified'
  | 'partial'
  | 'insufficient'
  | 'candidate'
  | 'inferred'
  | 'unsupported'
  | 'stale'
  | 'legacy';

export const evidenceStatusMeta: Record<
  EvidenceStatus,
  {
    label: string;
    description: string;
    color: string;
    className: string;
  }
> = {
  verified: {
    label: 'Verified',
    description: 'Source-backed evidence is available.',
    color: observatoryColors.citrine,
    className: 'obs-status obs-status--verified',
  },
  partial: {
    label: 'Partial',
    description: 'Some evidence is source-backed and some remains inferred or incomplete.',
    color: observatoryColors.clay,
    className: 'obs-status obs-status--partial',
  },
  insufficient: {
    label: 'Insufficient',
    description: 'The backend found this area, but source evidence is incomplete.',
    color: observatoryColors.clay,
    className: 'obs-status obs-status--insufficient',
  },
  candidate: {
    label: 'Candidate',
    description: 'This area is plausible but not promoted to verified evidence.',
    color: observatoryColors.stone,
    className: 'obs-status obs-status--candidate',
  },
  inferred: {
    label: 'Inferred',
    description: 'This is inferred from structure rather than direct source spans.',
    color: observatoryColors.clay,
    className: 'obs-status obs-status--inferred',
  },
  unsupported: {
    label: 'Unsupported',
    description: 'The available source evidence does not support this claim.',
    color: observatoryColors.mutedRed,
    className: 'obs-status obs-status--unsupported',
  },
  stale: {
    label: 'Stale',
    description: 'This evidence may no longer match the current source snapshot.',
    color: observatoryColors.stone,
    className: 'obs-status obs-status--stale',
  },
  legacy: {
    label: 'Legacy',
    description: 'This area comes from a legacy projection or compatibility path.',
    color: observatoryColors.stone,
    className: 'obs-status obs-status--legacy',
  },
};
