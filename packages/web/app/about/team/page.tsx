import Image from 'next/image'
import Link from 'next/link'
import { Briefcase } from '@phosphor-icons/react/dist/ssr'
import { initials } from '@splat-connect/types'

export const metadata = { title: 'Our team — SPLAT Connect' }

/**
 * REPLACE BEFORE LAUNCH. `photo` stays null until real headshots exist — the
 * initials block below covers that case, so a missing photo is not a broken card.
 */
export const TEAM_MEMBERS: Array<{
  name: string
  role: string
  bio: string
  /** What they do for a living — the board's briefcase line. Optional. */
  day?: string
  photo: string | null
}> = [
  {
    name: 'TODO: full name',
    role: 'TODO: role',
    bio: 'TODO: one or two sentences — what they do here, and what they did before.',
    photo: null,
  },
]

// The board tints each portrait slot and its role pill with the same colour,
// in this order.
const TINTS = ['var(--b100)', 'var(--tmint)', 'var(--tcoral)', 'var(--tamber)', 'var(--tviolet)', 'var(--tok)']

type Member = (typeof TEAM_MEMBERS)[number]

function Portrait({ member, tint }: { member: Member; tint: string }) {
  return member.photo ? (
    <Image src={member.photo} alt="" fill className="object-cover" />
  ) : (
    <span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center font-display text-4xl font-extrabold text-[var(--tink)]"
      style={{ background: tint }}
    >
      {initials(member.name)}
    </span>
  )
}

export default function TeamPage() {
  const [lead, ...rest] = TEAM_MEMBERS
  return (
    <div>
      <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">About</span>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Our team
      </h1>
      <p className="mt-3 max-w-[58ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        Everyone here does something else for a living, and the bios say so. Every one of us
        also has a contributor profile, because we build toys too.
      </p>

      {lead && (
        <div
          className="mt-[34px] grid overflow-hidden rounded-card border border-line bg-surface text-ink sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
          style={{ boxShadow: 'var(--shadow-e3), var(--shadow-hi)' }}
        >
          <span className="relative block min-h-[320px]" style={{ background: TINTS[0] }}>
            <Portrait member={lead} tint={TINTS[0]} />
          </span>
          <span className="flex flex-col justify-center gap-3 px-10 py-9">
            <span
              className="self-start rounded-pill px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--tink)]"
              style={{ background: TINTS[0] }}
            >
              {lead.role}
            </span>
            <span className="font-display text-[clamp(28px,3vw,38px)] font-extrabold leading-[1.1] tracking-[-0.02em]">
              {lead.name}
            </span>
            <span className="text-[16.5px] leading-[1.6] text-muted [text-wrap:pretty]">{lead.bio}</span>
            {lead.day && (
              <span className="text-sm font-semibold text-muted">
                <Briefcase size={14} weight="bold" className="mr-1.5 inline text-[var(--b600)]" aria-hidden="true" />
                {lead.day}
              </span>
            )}
          </span>
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-[22px] grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {rest.map((member, i) => {
            const tint = TINTS[(i + 1) % TINTS.length]
            return (
              <div key={member.name} className="card flex flex-col overflow-hidden text-ink">
                <span className="relative block aspect-[4/3]" style={{ background: tint }}>
                  <Portrait member={member} tint={tint} />
                </span>
                <span className="flex flex-1 flex-col gap-1.5 px-[18px] pb-5 pt-4">
                  <span
                    className="self-start rounded-pill px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--tink)]"
                    style={{ background: tint }}
                  >
                    {member.role}
                  </span>
                  <span className="mt-0.5 font-display text-[19px] font-extrabold">{member.name}</span>
                  <span className="text-sm leading-[1.5] text-muted">{member.bio}</span>
                  {member.day && (
                    <span className="mt-auto pt-2 text-[13px] font-semibold text-muted">
                      <Briefcase size={13} weight="bold" className="mr-[5px] inline text-[var(--b600)]" aria-hidden="true" />
                      {member.day}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-10 grid items-center gap-5 rounded-card border border-line bg-[var(--tmint)] px-[30px] py-[26px] sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 className="mb-1 font-display text-[22px] font-extrabold text-[var(--tink)]">
            We are always short of reviewers
          </h2>
          <p className="m-0 text-[15px] leading-[1.55] text-[var(--tink)]">
            If you are an OT, a teacher or an engineer with an hour a fortnight, the review queue
            is where it counts.
          </p>
        </div>
        <Link
          href="/get-involved/contributors"
          className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-pill bg-ink px-5 text-[15px] font-extrabold text-surface"
        >
          Volunteer with us
        </Link>
      </div>
    </div>
  )
}
