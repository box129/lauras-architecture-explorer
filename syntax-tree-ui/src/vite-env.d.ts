/// <reference types="vite/client" />

/** Injected by vite.config.ts `define` — the real checkout/commit this
 * build was served from, so a running instance is distinguishable from a
 * sibling checkout of the same product. */
declare const __BUILD_COMMIT__: string;
declare const __BUILD_WORKSPACE__: string;
