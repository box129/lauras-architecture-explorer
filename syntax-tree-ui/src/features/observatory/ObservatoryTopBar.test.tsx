import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ObservatoryTopBar from './ObservatoryTopBar';

/**
 * Regression coverage for a live product audit finding: global navigation
 * (Architecture / Documentation / Settings / Analyze another repository)
 * and architectural-history Back were the same button, so once the user
 * had any navigation history (canGoBack), the hamburger was replaced by
 * Back and the whole navigation menu became unreachable without backing
 * out to repository root first. Global nav must stay reachable at every
 * depth, and Back must keep working independently of it.
 */
describe('ObservatoryTopBar navigation', () => {
  const baseProps = {
    breadcrumb: [],
    repoTitle: 'flask',
    runId: 'run:1',
    freshness: 'fresh',
    lastScanned: 'active run',
    onOpenDocs: vi.fn(),
    onAnalyzeAnotherRepository: vi.fn(),
  };

  it('shows the global navigation trigger when there is no history to go back through', () => {
    render(<ObservatoryTopBar {...baseProps} canGoBack={false} />);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('keeps the global navigation trigger reachable even after entering a structural region (canGoBack true)', () => {
    render(<ObservatoryTopBar {...baseProps} canGoBack onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('opens the navigation menu with Documentation, Settings, and Analyze another repository, independent of Back', () => {
    const onBack = vi.fn();
    render(<ObservatoryTopBar {...baseProps} canGoBack onBack={onBack} onOpenLenses={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('menuitem', { name: /Documentation \/ Doc Studio/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Analyze another repository/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Lenses & tours/ })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('calls onBack from the Back button without opening the navigation menu', () => {
    const onBack = vi.fn();
    render(<ObservatoryTopBar {...baseProps} canGoBack onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
