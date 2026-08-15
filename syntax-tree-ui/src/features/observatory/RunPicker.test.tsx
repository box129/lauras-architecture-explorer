import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RunPicker from './RunPicker';

/**
 * Regression coverage for Claude Design UX audit finding F05: the raw run
 * id ("run:1f7f34f034dc4674a8f395f29adb58ee") was previously the most
 * prominent text in the header, immediately after the user's first action.
 * It's still real, useful provenance data -- these tests check it's no
 * longer the primary label and is never silently dropped.
 */
describe('RunPicker', () => {
  const runId = 'run:1f7f34f034dc4674a8f395f29adb58ee';

  it('shows meaningful context (freshness/lastScanned) as the primary visible label', () => {
    render(<RunPicker runId={runId} freshness="fresh" lastScanned="active run" />);
    expect(screen.getByText('active run')).toBeInTheDocument();
  });

  it('does not render the full raw run id as plain visible text', () => {
    render(<RunPicker runId={runId} freshness="fresh" lastScanned="active run" />);
    // The full id must not appear as its own rendered text node -- only
    // abbreviated, or inside a title/aria-label attribute.
    expect(screen.queryByText(runId)).not.toBeInTheDocument();
  });

  it('keeps the full run id available (abbreviated on screen, full value via title/aria-label and copy)', () => {
    render(<RunPicker runId={runId} freshness="fresh" lastScanned="active run" />);
    const idEl = screen.getByLabelText(`Run id ${runId}`);
    expect(idEl).toBeInTheDocument();
    expect(idEl.textContent?.length ?? 0).toBeLessThan(runId.length);

    expect(screen.getByRole('button', { name: 'Copy full run id' })).toHaveAttribute('title', runId);
  });
});
