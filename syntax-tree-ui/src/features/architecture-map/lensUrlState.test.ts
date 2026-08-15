import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushObservatoryUrlState, readObservatoryUrlState, setObservatoryUrlState } from './lensUrlState';

/**
 * Browser Back/Forward integration (Phase A navigation-foundation work):
 * user-initiated navigation must push a new history entry so the browser's
 * own Back/Forward walks the same Overview/Area/Entity stack as the in-app
 * Back control, instead of leaving the app on the first Back press.
 * Non-navigational corrections (e.g. resetting lens state when the active
 * analysis run changes) must keep using replaceState so they do not become
 * a spurious Back stop.
 */
describe('lensUrlState push vs replace', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushObservatoryUrlState pushes a new history entry', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    pushObservatoryUrlState({ lensPath: ['area:1'], selectedNodeId: null });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('setObservatoryUrlState replaces the current history entry', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    setObservatoryUrlState({ lensPath: [], selectedNodeId: null });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('round-trips lensPath and selectedNodeId through the URL', () => {
    pushObservatoryUrlState({ lensPath: ['area:1', 'symbol:2'], selectedNodeId: 'symbol:2' });

    const state = readObservatoryUrlState();

    expect(state.lensPath).toEqual(['area:1', 'symbol:2']);
    expect(state.selectedNodeId).toBe('symbol:2');
  });

  it('a real browser Back press (popstate) is observable after two pushes', async () => {
    pushObservatoryUrlState({ lensPath: ['area:1'], selectedNodeId: null });
    pushObservatoryUrlState({ lensPath: ['area:1'], selectedNodeId: 'symbol:2' });

    const popped = new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true });
    });
    window.history.back();
    await popped;

    expect(readObservatoryUrlState()).toEqual({ lensPath: ['area:1'], selectedNodeId: null });
  });
});
