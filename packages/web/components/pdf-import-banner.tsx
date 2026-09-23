'use client'
/**
 * The editor's reminder after "Start from a PDF" (pdf-import-flow.tsx lands
 * on ?from=pdf). Stays for the visit rather than toasting: the draft is a
 * guess from the PDF's text, and the point is that the author checks it.
 */
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const SECTION_NAME: Record<string, string> = {
  pdf: 'the PDF itself',
  details: 'the build time and ages',
  parts: 'the parts',
  tools: 'the tools',
  steps: 'the steps',
}

export function PdfImportBanner() {
  // Read once: the stepper rewrites the URL to ?step=… on every section change,
  // and the reminder should outlast that.
  const current = useSearchParams()
  const [params] = useState(() => new URLSearchParams(current))
  if (params.get('from') !== 'pdf') return null
  const missed = (params.get('missed') ?? '').split(',').filter((k) => k in SECTION_NAME)
  return (
    <div role="status" className="alert alert-warning mb-4">
      <p className="font-bold">Filled in from your PDF — check every section before you submit.</p>
      <p className="mt-1">
        It is a best guess from the PDF&apos;s text. Photos inside the PDF were not copied.
      </p>
      {params.get('steps') === 'later' && (
        <p className="mt-1">
          The steps found in your PDF could not be saved yet — add them in the Steps section, or copy
          them from the PDF.
        </p>
      )}
      {missed.length > 0 && (
        <p className="mt-1">Could not save {missed.map((k) => SECTION_NAME[k]).join(', ')} — add them in the editor.</p>
      )}
    </div>
  )
}
