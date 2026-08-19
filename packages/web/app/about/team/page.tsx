import { EditorialImage } from '@/components/editorial-image'

export const metadata = { title: 'Our team — SPLAT Connect' }

/**
 * REPLACE BEFORE LAUNCH. `photo` stays null until real headshots exist — the
 * initials block below covers that case, so a missing photo is not a broken card.
 */
export const TEAM_MEMBERS: Array<{
  name: string
  role: string
  bio: string
  photo: string | null
}> = [
  {
    name: 'TODO: full name',
    role: 'TODO: role',
    bio: 'TODO: one or two sentences — what they do here, and what they did before.',
    photo: null,
  },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function TeamPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Our team</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        A small group of people, plus every contributor and organisation whose name
        appears on a guide.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_MEMBERS.map((member) => (
          <div key={member.name} className="card p-5">
            {member.photo ? (
              <EditorialImage src={member.photo} illustration="maker" ratio="1/1" />
            ) : (
              <div
                aria-hidden="true"
                className="grid aspect-square w-full place-items-center rounded-[14px] bg-brand-tint text-3xl font-bold text-brand-deep"
              >
                {initials(member.name)}
              </div>
            )}
            <p className="mt-4 font-bold text-ink">{member.name}</p>
            <p className="text-sm font-semibold text-brand-dark">{member.role}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{member.bio}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
