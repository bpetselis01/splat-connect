'use client'
/**
 * The board's Share control on a detail page's rail.
 *
 * The platform share sheet where there is one (phones, Safari), the clipboard
 * everywhere else — a desktop visitor asking to share wants a link to paste,
 * and a toast confirms it went.
 */
import { LinkSimple, ShareNetwork } from '@phosphor-icons/react/dist/ssr'
import { useToast } from '@/components/toast'

export function ShareButton({
  title,
  className = '',
  copyLink = false,
}: {
  title: string
  className?: string
  /** The story page's variant: labelled "Copy link", same behaviour. */
  copyLink?: boolean
}) {
  const showToast = useToast()

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast('Link copied')
      }
    } catch {
      // Dismissing the share sheet rejects too; that is not a failure to report.
    }
  }

  return (
    <button type="button" onClick={share} className={`btn btn-quiet ${className}`.trim()}>
      {copyLink ? (
        <LinkSimple size={16} weight="bold" aria-hidden="true" />
      ) : (
        <ShareNetwork size={18} aria-hidden="true" />
      )}
      {copyLink ? 'Copy link' : 'Share'}
    </button>
  )
}
