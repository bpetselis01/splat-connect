'use client'
/**
 * Announces the create, which the redirect out of /upload cannot do for
 * itself. NewTutorialForm lands on ?step=files&created=1; both pages draw the
 * same pills and the same panel, so without this the handover reads as being
 * thrown somewhere else rather than as a step completed.
 *
 * Its own component because useToast() only works below ToastProvider, and it
 * lived in the tutorial stepper only because that is where the provider was
 * mounted — which is also the one thing that stopped the three steppers being
 * one. The provider moved up to the edit page and this came with it.
 */
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { useToast } from '@/components/toast'

export function CreatedToast() {
  const showToast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const created = searchParams.get('created')

  // The same URL with the flag dropped, so a refresh does not announce it a
  // second time and the step you arrived on is kept.
  const rest = new URLSearchParams(searchParams)
  rest.delete('created')
  const cleared = rest.toString() ? `${pathname}?${rest}` : pathname

  useEffect(() => {
    if (!created) return
    showToast('Tutorial created. Add the guide and a photo next.')
    router.replace(cleared as Route<string>, { scroll: false })
  }, [created, cleared, showToast, router])

  return null
}
