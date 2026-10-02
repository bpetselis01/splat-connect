// A control the board draws that the app cannot do yet: styled like the real
// one, linking to /not-built/<id>. The `pending` literal is what the drift
// test (packages/api/tests/unit/pending-features.test.ts) finds.
import Link from 'next/link'
import type { Route } from 'next'
import type { PendingId } from '@splat-connect/types'

export function PendingButton({
  pending,
  label,
  className = 'btn btn-quiet',
}: {
  pending: PendingId
  label: string
  className?: string
}) {
  return (
    <Link href={`/not-built/${pending}` as Route} className={className}>
      {label}
    </Link>
  )
}
