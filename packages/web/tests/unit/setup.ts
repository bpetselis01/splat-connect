import '@testing-library/jest-dom'

// jsdom (24.x) reflects the <dialog> `open` attribute but implements neither
// showModal() nor close() — needed by shell-frame.tsx's mobile drawer and
// contributor-terms-dialog.tsx. Polyfilled here (not per-test) since both
// components call these unconditionally in an effect on mount.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
