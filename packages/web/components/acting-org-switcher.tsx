'use client'
import { useState, useTransition } from 'react'
import { Buildings, CaretDown, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { setActingOrg } from '@/app/dashboard/organisation/acting-org-actions'

type Org = { id: string; name: string; status: string }

/** The phone's "Acting for" pill and picker, for a leader of two or more organisations. */
export function ActingOrgSwitcher({ orgs, currentId }: { orgs: Org[]; currentId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const current = orgs.find((o) => o.id === currentId) ?? orgs[0]

  return (
    <div className="mb-[22px] max-w-[520px]">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Acting for ${current.name}. Change organisation.`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-pill border border-line bg-surface py-2 pl-2.5 pr-4 text-left shadow-sm"
      >
        <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-[var(--b100)] text-[var(--tink)]">
          <Buildings weight="bold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted">Acting for</span>
          <span className="block truncate font-black text-ink">{current.name}</span>
        </span>
        <CaretDown aria-hidden="true" weight="bold" className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="mt-3 rounded-card border border-line bg-surface p-4">
          <h2 className="text-lg font-black text-ink">Act for which organisation?</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted">
            Events, stories, orders, inventory, recycling and your organisation&apos;s profile follow the one you pick.
          </p>
          <div role="radiogroup" aria-label="Organisation" className="flex flex-col gap-2">
            {orgs.map((o) => {
              const on = o.id === current.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setActingOrg(o.id)
                      setOpen(false)
                    })
                  }
                  className={`flex min-h-16 items-center gap-3 rounded-card border p-3 text-left ${on ? 'border-brand-dark bg-sunken' : 'border-line bg-surface'}`}
                >
                  <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-[var(--b100)] text-[var(--tink)]">
                    <Buildings weight="bold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-ink">{o.name}</span>
                    <span className="block text-xs capitalize text-muted">{o.status}</span>
                  </span>
                  {on && <CheckCircle aria-hidden="true" weight="fill" size={24} className="text-brand-dark" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
