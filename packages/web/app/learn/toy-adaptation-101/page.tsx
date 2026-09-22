import { Lightbulb } from '@phosphor-icons/react/dist/ssr'
import { LearnShell } from '@/components/learn-shell'
import { LessonH2, PhotoSlot } from '@/components/lesson-kit'

export const metadata = {
  title: 'Toy adaptation 101 — SPLAT Connect',
  description: 'What adapting a toy means, the two ways to do it, and why it is worth an afternoon.',
}

const ROUTES = [
  {
    kicker: 'Route A · No soldering',
    title: 'The battery interrupter',
    body: "A thin copper disc on a wire slides between one battery and its contact, breaking the circuit until a switch plugged into the disc's lead joins it again. Removable, reversible, a few dollars. Nothing is drilled or soldered, and the toy works normally the moment you take the disc out.",
    best: 'Best for: toys with a simple on/off switch that stays on.',
    tint: 'var(--tmint)',
  },
  {
    kicker: 'Route B · Inside the case',
    title: 'A socket wired to the button',
    body: "Open the toy, find the two solder points of its button, and solder a 3.5 mm socket across them. The child's switch now does exactly what the button does — including momentary presses. This is what the workshop toys in Unit 4 use, and it is a twenty-minute job once you have done it once.",
    best: 'Best for: press-and-go toys, or anything with a start-up sequence.',
    tint: 'var(--b100)',
  },
]

export default function Adaptation101() {
  return (
    <LearnShell slug="toy-adaptation-101">
      <PhotoSlot
        label="Photo: a battery interrupter fitted into a toy's battery compartment"
        className="my-[30px] aspect-[2/1] w-full rounded-card border border-line shadow-[var(--e2)]"
      />

      <LessonH2 className="mb-2 mt-9">The whole trick in one paragraph</LessonH2>
      <p className="leading-[1.6] text-ink">
        Every battery toy has a button somewhere that a child cannot reach, press hard enough, or
        hold. Adapting it means giving that button a second, bigger body — a switch the child can
        use — so that pressing either one makes the toy go. That is the entire job. Everything in
        this course is about doing it neatly and safely.
      </p>

      <LessonH2>There are two ways in</LessonH2>
      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
        {ROUTES.map((r) => (
          <div
            key={r.title}
            className="rounded-card border border-line px-6 py-[22px] text-[var(--tink)]"
            style={{ background: r.tint }}
          >
            <span className="text-xs font-extrabold uppercase tracking-[0.1em] opacity-75">{r.kicker}</span>
            <h3 className="mb-2 mt-1.5 font-display text-[21px] font-extrabold">{r.title}</h3>
            <p className="text-[15px] leading-[1.55]">{r.body}</p>
            <p className="mt-2.5 text-sm font-bold">{r.best}</p>
          </div>
        ))}
      </div>

      <p className="my-[26px] rounded-[var(--radius-inset)] border border-line bg-[var(--tamber)] px-[22px] py-5 font-bold text-[var(--tink)]">
        <Lightbulb weight="fill" className="mr-2 inline align-[-2px]" aria-hidden="true" />
        Try this first: check whether the toy already has a 3.5&nbsp;mm socket. A surprising number
        of newer sensory toys ship switch-ready and nobody says so on the box.
      </p>

      <LessonH2>Why bother</LessonH2>
      <p className="leading-[1.6] text-ink">
        Play is how children learn cause and effect, and a child who cannot operate a toy is shut out
        of that. Commercially adapted toys cost three to five times the shelf price of the same toy.
        The skills in this course let a family do the same job at home for the cost of a socket and
        an afternoon.
      </p>
    </LearnShell>
  )
}
