import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'Get involved — SPLAT Connect',
  description:
    'Three ways in: adapt a toy for your own child, make toys for other people, or bring your organisation in behind the work.',
}

const TRACKS = [
  '/get-involved/families',
  '/get-involved/contributors',
  '/get-involved/organisations',
]

export default function GetInvolvedPage() {
  const section = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
  const tracks = section.children.filter((c) => TRACKS.includes(c.href))
  const actions = section.children.filter((c) => !TRACKS.includes(c.href))

  return (
    <div>
      <h1 className="title-hub">Get involved</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        SPLAT runs on unpaid work. Contributors adapt toys and write down how, people
        and organisations pass on toys they no longer need, and organisations put their
        name behind work so a parent knows someone competent read it. Any of those is a
        way in.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">Which one are you?</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Each of these walks through the whole path, start to finish.
      </p>
      <HubGrid items={tracks} tone={section.tone} />

      <h2 className="mt-10 text-lg font-bold text-ink">Specific things you can do</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Smaller, more concrete. Some are not built yet — those say so.
      </p>
      <HubGrid items={actions} tone={section.tone} leadFirst={false} />
    </div>
  )
}
