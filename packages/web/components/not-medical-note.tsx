import Link from 'next/link'

/**
 * The quiet regulatory disclaimer (see /legal/intended-purpose). Rendered
 * wherever a child profile is created or edited and wherever suggested guides
 * are shown to a parent. Understated on purpose — honest context, not a
 * warning banner.
 */
export function NotMedicalNote() {
  return (
    <p className="text-xs leading-relaxed text-muted">
      Suggestions are for toys and everyday aids only. SPLAT Connect is not a medical
      device and does not replace advice from your child&apos;s therapist or doctor.{' '}
      <Link href="/legal/intended-purpose" className="underline">
        Read more
      </Link>
    </p>
  )
}
