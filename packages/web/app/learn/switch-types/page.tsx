import { LearnShell } from '@/components/learn-shell'
import { PhotoSlot } from '@/components/lesson-kit'

export const metadata = {
  title: 'Switch types explained — SPLAT Connect',
  description: 'Buttons, levers, proximity and grasp — which suits which child.',
}

const SWITCHES = [
  {
    name: 'Big button',
    desc: 'A 100 mm domed disc that clicks. The default first switch, and the one most guides assume.',
    suits: 'Whole-hand or fist contact',
    force: '150 g',
    cost: '$45–70',
    tint: 'var(--b100)',
    ph: 'Photo: 100 mm domed button switch',
  },
  {
    name: 'Lever',
    desc: 'A paddle on a hinge. Rewards a sideways sweep rather than a downward press.',
    suits: 'Limited downward force',
    force: '60 g',
    cost: '$70–110',
    tint: 'var(--tmint)',
    ph: 'Photo: lever/paddle switch',
  },
  {
    name: 'Proximity',
    desc: 'Fires when a hand comes near. No contact, no force, no travel.',
    suits: 'Very limited movement',
    force: 'None',
    cost: '$180+',
    tint: 'var(--tviolet)',
    ph: 'Photo: proximity sensor switch',
  },
  {
    name: 'Grasp / squeeze',
    desc: 'A soft bulb or pad that closes when squeezed anywhere on its surface.',
    suits: 'Grip, no fine aim',
    force: '80 g',
    cost: '$90–140',
    tint: 'var(--tcoral)',
    ph: 'Photo: squeeze bulb switch',
  },
]

export default function SwitchTypes() {
  return (
    <LearnShell slug="switch-types">
      <div className="mt-[34px] grid gap-5 sm:grid-cols-2">
        {SWITCHES.map((s) => (
          <article
            key={s.name}
            className="overflow-hidden rounded-card border border-line bg-surface shadow-[var(--e2),var(--hi)]"
          >
            <div className="h-[150px]" style={{ background: s.tint }}>
              <PhotoSlot label={s.ph} className="h-full w-full" />
            </div>
            <div className="px-[22px] pb-6 pt-5">
              <h2 className="mb-1.5 font-display text-[21px] font-extrabold text-ink">{s.name}</h2>
              <p className="mb-3.5 text-[15px] leading-[1.55] text-muted">{s.desc}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="font-bold text-ink">Suits</dt>
                <dd className="text-muted">{s.suits}</dd>
                <dt className="font-bold text-ink">Force</dt>
                <dd className="text-muted">{s.force}</dd>
                <dt className="font-bold text-ink">Cost</dt>
                <dd className="text-muted">{s.cost}</dd>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-[22px] grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-inset)] border border-line bg-brand-50 px-6 py-[22px]">
          <h2 className="mb-1.5 font-display text-[19px] font-extrabold text-ink">
            Ask the occupational therapist first
          </h2>
          <p className="text-[15px] leading-[1.55] text-muted">
            If a child already has a switch for communication or a powered chair, use the same one. A
            second switch with a different action in the same day is a new skill, not a shortcut.
          </p>
        </div>
        <div className="rounded-[var(--radius-inset)] border border-line bg-[var(--tcoral)] px-6 py-[22px] text-[var(--tink)]">
          <h2 className="mb-1.5 font-display text-[19px] font-extrabold">Or make one for under $5</h2>
          <p className="text-[15px] leading-[1.55]">
            A 3D-printed button switch with an adjustable insert costs a few dollars in parts. Unit 5
            builds it step by step; you will want Unit 3 first.
          </p>
        </div>
      </div>
    </LearnShell>
  )
}
