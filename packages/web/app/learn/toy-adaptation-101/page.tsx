import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: 'Toy adaptation 101 — SPLAT Connect',
  description: 'What a battery interrupter is, and why it is the whole trick.',
}

export default function Adaptation101() {
  return (
    <ProsePage
      title="Toy adaptation 101"
      intro="Almost every adapted toy on this site works the same way, and the trick is smaller than you would expect. Once you have seen it once, you will see it everywhere."
    >
      <EditorialImage illustration="switch" ratio="2/1" />

      <section>
        <h2>The problem</h2>
        <p>
          Most toys are switched on by a small stiff button, a slide, or by squeezing a
          particular spot. A child with limited hand strength, limited fine motor
          control, or involuntary movement may not be able to operate any of them — not
          because the toy is too complicated, but because the button is too small and in
          the wrong place.
        </p>
        <p>
          Adapting a toy does not change what it does. It moves the act of turning it on
          to a switch the child <em>can</em> operate: a big one, a light one, one mounted
          on a wheelchair tray, one worked with a cheek or a foot.
        </p>
      </section>

      <section>
        <h2>The battery interrupter</h2>
        <p>
          Here is the whole idea. A battery-powered toy is a circuit, and that circuit
          runs through the battery compartment. If you break the circuit at one battery
          contact and route those two ends out to a switch, the toy only runs while the
          switch is held.
        </p>
        <p>
          A <strong>battery interrupter</strong> is a thin disc of insulating material
          with a metal contact on one face and a wire from each side. It slips between a
          battery and the spring contact in the compartment. No soldering inside the
          toy, no opening the case, and completely reversible — pull it out and the toy
          is exactly as it was.
        </p>
        <p>
          The two wires end in a <strong>3.5 mm mono socket</strong>, which is the
          standard connector across assistive switches. Use it, and the toy will work
          with switches a family may already own.
        </p>
      </section>

      <section>
        <h2>When an interrupter is not enough</h2>
        <p>
          Some toys will not cooperate. If the toy latches — one press starts it, another
          stops it — then cutting power mid-cycle may leave it stuck, or restart it from
          the beginning every time. If the toy has a microcontroller that needs to boot,
          it may not respond fast enough to a momentary switch.
        </p>
        <p>
          In those cases the adaptation moves inside: you open the toy and wire the
          switch in parallel with the toy&apos;s own button, so pressing either one does
          the same thing. That means soldering, and it means the guide for that toy will
          tell you exactly which two pads to bridge. This is where the library earns its
          keep — somebody has already worked it out.
        </p>
      </section>

      <section>
        <h2>Momentary or latching</h2>
        <p>
          <strong>Momentary</strong> means the toy runs while the switch is held and stops
          when it is released. It is the simplest to build and, for many children, the
          most rewarding: cause and effect are immediate and unambiguous.
        </p>
        <p>
          <strong>Latching</strong> means one press starts it and the next stops it. It
          suits a child who cannot sustain a press, and it needs a latching switch
          interface between the switch and the toy rather than any change to the toy.
        </p>
      </section>

      <section>
        <h2>What to read next</h2>
        <p>
          <Link href="/learn/switch-types">Switch types explained</Link> covers which
          switch suits which child, and <Link href="/learn/choosing-a-toy">choosing a toy
          to adapt</Link> covers which toys take to this well. When you are ready to
          build, the <Link href="/library">Guides</Link> have the step-by-step for
          specific toys.
        </p>
      </section>
    </ProsePage>
  )
}
