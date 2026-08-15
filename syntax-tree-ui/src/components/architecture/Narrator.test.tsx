import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Narrator from './Narrator';
import { useSyntaxTreeStore } from '../../store';

/**
 * Participant 1 formative usability finding: "how does this play guide
 * thing works, it doesn't seem to work." Traced to: clicking "Take the
 * Tour" (Dashboard.tsx -> store.startNarrator) always set narratorActive,
 * but this component previously returned null with zero visible feedback
 * whenever the legacy overview/subsystems/violations data it depends on
 * came back empty -- which it reliably does for any run produced by the
 * current Observatory pipeline. These tests lock in the honest fallback.
 */
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitView: vi.fn(),
    setCenter: vi.fn(),
    getNode: vi.fn(() => undefined),
  }),
}));

vi.mock('../../api/hooks', () => ({
  useArchOverview: () => ({ data: undefined }),
  useSubsystems: () => ({ data: undefined }),
  useViolations: () => ({ data: undefined }),
}));

afterEach(() => {
  useSyntaxTreeStore.getState().stopNarrator();
});

describe('Narrator honest-empty-state (no data to tour)', () => {
  it('shows an honest, dismissible message instead of silently rendering nothing', () => {
    useSyntaxTreeStore.getState().startNarrator();

    render(<Narrator />);

    expect(screen.getByText(/nothing to walk through right now/i)).toBeInTheDocument();
  });

  it('dismisses cleanly via the honest state\'s own Close button', async () => {
    useSyntaxTreeStore.getState().startNarrator();
    const user = userEvent.setup();

    render(<Narrator />);
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(useSyntaxTreeStore.getState().narratorActive).toBe(false);
  });

  it('renders nothing at all when the tour was never started', () => {
    const { container } = render(<Narrator />);
    expect(container).toBeEmptyDOMElement();
  });
});
