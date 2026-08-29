import '@testing-library/jest-dom'

// This setup file also runs for route-handler tests that opt into the node
// environment via a `// @vitest-environment node` pragma (e.g.
// tests/unit/app/files-route.test.ts) — there is no window or
// HTMLDialogElement there, so every polyfill below is guarded.

// jsdom (24.x) reflects the <dialog> `open` attribute but implements neither
// showModal() nor close() — needed by shell-frame.tsx's mobile drawer,
// contributor-terms-dialog.tsx, and delete-child-button.tsx. Polyfilled here
// (not per-test) since these components call them unconditionally in an
// effect on mount.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// jsdom does not implement ResizeObserver at all. components/nav.tsx observes
// its own <header> to keep --header-h (app/globals.css's .shell-rail offset)
// correct; the callback firing is not what any unit test asserts, so a no-op
// stub is enough — same "polyfill the missing API globally" approach as the
// <dialog> methods above rather than a per-test mock.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub
}
