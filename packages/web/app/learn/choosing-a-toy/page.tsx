import { CheckCircle, XCircle } from '@phosphor-icons/react/dist/ssr'
import { LearnShell } from '@/components/learn-shell'
import { LessonH2 } from '@/components/lesson-kit'

export const metadata = {
  title: 'Choosing a toy to adapt — SPLAT Connect',
  description: 'What makes a toy easy to adapt, and what makes it impossible.',
}

const GOOD = [
  'Runs on AA, AAA or C cells in an accessible compartment',
  'One obvious button — it does a thing and stops',
  'The reaction is immediate: sound, light or movement',
  'Screws you can see, not glue or hidden clips',
  'Sturdy enough to be dropped, and wipeable',
  'Interesting for more than a minute at a time',
]

const BAD = [
  // Not on the board. Kept anyway: it is the one toy that must never be adapted.
  'Mains power or a plug-in adapter — never adapt these, at all',
  'Sealed rechargeable battery, no cells to interrupt',
  'Screen-based or menu-driven — a switch has nothing to press',
  'Takes button cells in a compartment that is not screwed shut',
  'Small detachable parts that fail a choke test',
  'Loud with no volume control',
]

export default function ChoosingAToy() {
  return (
    <LearnShell slug="choosing-a-toy">
      <div className="mt-[34px] grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-[var(--tok)] p-6">
          <h2 className="mb-3.5 flex items-center gap-2 font-display text-xl font-extrabold text-ink">
            <CheckCircle weight="fill" className="text-success" aria-hidden="true" />
            Good candidate
          </h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[15px] text-[var(--tink)]">
            {GOOD.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-line bg-[var(--tbad)] p-6">
          <h2 className="mb-3.5 flex items-center gap-2 font-display text-xl font-extrabold text-ink">
            <XCircle weight="fill" className="text-danger" aria-hidden="true" />
            Walk away
          </h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[15px] text-[var(--tink)]">
            {BAD.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>

      <LessonH2 className="mb-2.5 mt-10">The two-minute test in a shop</LessonH2>
      <ol className="flex list-decimal flex-col gap-2.5 pl-[22px] leading-[1.55] text-ink">
        <li>Open the battery door. If you cannot see the cells, put it back.</li>
        <li>
          Turn it on and press the action once. Count how long before something happens — over a
          second is too long for cause and effect.
        </li>
        <li>
          Turn it off and on again. If it replays a jingle or a start-up sequence, an interrupter will
          be maddening — plan on Route B.
        </li>
        <li>
          Turn it over. Count the screws and note the head shape. Triangular heads are common and a
          2.0&nbsp;mm flathead will turn them slowly.
        </li>
        <li>Hold it at arm&apos;s length. Would you want to hear this fifty times in a row?</li>
      </ol>

      <p className="mt-[34px] rounded-[var(--radius-inset)] border border-line bg-surface px-6 py-[22px] leading-[1.55] text-ink shadow-[var(--e2)]">
        <strong>Two toys that pass every test</strong> — Hamster Mania (about $15) and the duck bubble
        machine (about $12) — are the builds in Unit 4. If you want to follow along with real
        hardware, buy one of those.
      </p>
    </LearnShell>
  )
}
