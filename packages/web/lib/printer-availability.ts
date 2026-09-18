import type { PrinterWithOwner } from '@splat-connect/types'

/**
 * Whether this machine can take a job right now, and why not when it cannot.
 *
 * Lives here rather than in request-print-form.tsx because both the server
 * component at /printing/requests and the client form need it. Every export of
 * a 'use client' module is a client reference, so the server importing it from
 * there threw "Attempted to call printerAvailability() from the server" and
 * 500'd the page — a pure function has no business sitting behind that
 * boundary.
 */
export function printerAvailability(printer: PrinterWithOwner): string | null {
  if (!printer.accepting) return 'Not taking new jobs'
  if (printer.open_jobs >= printer.capacity) return 'Full right now'
  return null
}
