import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Choosing a toy to adapt — SPLAT Connect',
  description: 'What makes a toy easy to adapt, and what makes it impossible.',
}

export default function ChoosingAToy() {
  return (
    <ProsePage
      title="Choosing a toy to adapt"
      intro="The best toy to adapt is one the child already wants. Everything below is about whether that toy will cooperate — and if it won't, what to look for instead."
    >
      <section>
        <h2>Signs a toy will be easy</h2>
        <ul>
          <li>
            <strong>It runs on AA, AAA, C or D cells.</strong> A removable cylindrical
            battery is what a battery interrupter needs.
          </li>
          <li>
            <strong>It does one thing.</strong> Press and it lights up, spins, sings.
            Single-function toys give unambiguous cause and effect, which is the whole
            point for a child learning that their action changes the world.
          </li>
          <li>
            <strong>Activation is momentary.</strong> Hold the button and it runs; let go
            and it stops. This maps directly onto a switch with no extra electronics.
          </li>
          <li>
            <strong>The battery compartment is roomy.</strong> An interrupter plus its
            wires need somewhere to sit and somewhere to leave the case.
          </li>
        </ul>
      </section>

      <section>
        <h2>Signs a toy will fight you</h2>
        <ul>
          <li>
            <strong>Mains power, or a plug-in adapter.</strong> Do not adapt these, at
            all. See the <Link href="/safety">safety page</Link>.
          </li>
          <li>
            <strong>A sealed or soldered-in battery,</strong> including rechargeable
            toys with a USB port. Nothing to interrupt.
          </li>
          <li>
            <strong>A button cell held in by a clip rather than a screw.</strong> Serious
            hazard, and not worth the risk. If the compartment does not screw shut, pick
            a different toy.
          </li>
          <li>
            <strong>Menus, modes, or a startup sequence.</strong> A toy that needs three
            presses to get going will frustrate a child using one switch.
          </li>
          <li>
            <strong>Latching behaviour</strong> — one press on, one press off. Adaptable,
            but it needs a latching interface rather than a plain switch.
          </li>
        </ul>
      </section>

      <section>
        <h2>Match the toy to the child, not to your skills</h2>
        <p>
          A toy that is easy to adapt but boring to the child is wasted effort. Ask what
          they already reach for. Consider what they get from it: is it the light, the
          sound, the vibration, the movement? A child with low vision may want the toy
          that rattles, not the one that flashes. A child who is sound-sensitive will
          hate the one that sings.
        </p>
      </section>

      <section>
        <h2>Check the library first</h2>
        <p>
          Before you open anything, search the <Link href="/library">Guides</Link>.
          Somebody may have adapted that exact toy and written down which wire goes
          where — including the traps. If they have not, and you work it out, please
          <Link href="/get-involved/submit-a-tutorial"> write it up</Link>: the next
          parent gets to skip the hard part.
        </p>
      </section>
    </ProsePage>
  )
}
