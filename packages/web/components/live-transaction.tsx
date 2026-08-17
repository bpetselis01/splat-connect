/**
 * Keeps an open exchange thread current: subscribes to inserts on this
 * transaction's messages and refetches the page's server data when one lands.
 *
 * Renders nothing. It sits beside ToyTransactionThread rather than inside it so
 * the thread stays presentational — its unit tests render it with plain props
 * and never have to stand up a fake Supabase client.
 *
 * router.refresh() rather than appending the payload row: the server component
 * stays the only source of truth for the thread, so there is nothing to
 * de-duplicate against the revalidatePath that a locally-sent message already
 * triggers. It also carries the transaction's own state along for free — accept,
 * reject, withdraw and confirm each insert a kind='system' row (see
 * packages/api/src/routes/toy-transactions.ts), so the notice that wakes us is
 * the same notice that means tx.status has moved, and the sidebar updates in the
 * same pass. A refresh re-renders server components without discarding client
 * state, so a half-typed draft in the composer survives.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LiveTransaction({ transactionId }: { transactionId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`toy-transaction:${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'toy_transaction_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        () => router.refresh()
      )
      // Anything inserted while the socket was down is missed outright — which
      // looks exactly like the stale thread this component exists to fix. So a
      // successful join refetches: on the first one that is a redundant refresh,
      // on every later one it closes the gap the drop opened.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') router.refresh()
      })

    // A backgrounded tab gets its socket throttled or dropped without ever
    // reporting a rejoin, so returning to the tab is its own resync trigger.
    function resyncOnFocus() {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', resyncOnFocus)

    return () => {
      document.removeEventListener('visibilitychange', resyncOnFocus)
      supabase.removeChannel(channel)
    }
  }, [transactionId, router])

  return null
}
