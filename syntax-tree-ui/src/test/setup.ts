import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver; @xyflow/react (the architecture
// map's React Flow canvas) requires it to mount at all. A minimal no-op
// stand-in is sufficient for component tests that render the canvas but
// don't assert on actual resize-driven layout.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
}
