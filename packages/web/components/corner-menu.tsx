'use client'
/**
 * The dock's corner, grown into a menu: on the two library pages the plain
 * "Back to My SPLAT" pill becomes a "+" trigger that fans the page's actions
 * upward (downward would leave the viewport). Back to My SPLAT stays as the
 * anchor item nearest the trigger, deep pill and mint dot intact, so the old
 * wayfinding affordance survives the upgrade.
 *
 * Rendered only by BackToMySplatDock, which owns the signed-in and
 * account-section guards — this component assumes it should be visible.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { BoundaryLink } from '@/components/boundary-link'

export type CornerMenuItem = {
  label: string
  href: string
  /** The create action — apricot. */
  primary?: boolean
  /** Back to My SPLAT — the dock pill's deep colour and mint dot. */
  anchor?: boolean
}

export function CornerMenu({ label, items }: { label: string; items: CornerMenuItem[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {open ? <div className="corner-menu-scrim" onClick={() => setOpen(false)} /> : null}
      <div className="corner-menu" data-open={open || undefined}>
        <button
          type="button"
          className="corner-menu-trigger"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen(!open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {/* Items stay mounted so the stagger can transition; inert keeps the
            closed menu out of the tab order and the accessibility tree.
            Items are ordered nearest-the-trigger first (anchor leads) and the
            column renders in reverse, so the fan grows upward from the dock's
            old spot. */}
        <div className="corner-menu-items" inert={!open}>
          {items.map((item, i) => (
            <BoundaryLink
              key={item.href}
              href={item.href}
              className={[
                'corner-menu-item',
                item.primary ? 'corner-menu-item--primary' : '',
                item.anchor ? 'corner-menu-item--anchor' : '',
              ].join(' ').trim()}
              style={{ '--i': i } as CSSProperties}
              onClick={() => setOpen(false)}
            >
              {item.anchor ? <span aria-hidden="true" className="dock-my-splat-dot" /> : null}
              {item.label}
            </BoundaryLink>
          ))}
        </div>
      </div>
    </>
  )
}
