import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Switch types explained — SPLAT Connect',
  description: 'Buttons, levers, proximity and grasp — which suits which child.',
}

export default function SwitchTypes() {
  return (
    <ProsePage
      title="Switch types explained"
      intro="A switch is the part the child actually touches, so it matters more than the toy does. Choosing it well is mostly about matching the movement a child already makes reliably."
    >
      <section>
        <h2>Start from the movement, not the switch</h2>
        <p>
          The question is never &ldquo;which switch is best&rdquo;. It is: what movement
          can this child make consistently, with little effort, without having to look at
          what they are doing? A press with the side of a fist counts. So does a head
          turn. Build around that movement, and the switch choice usually follows.
        </p>
        <p>
          If a child has an occupational therapist or a speech pathologist, ask them
          first. They have probably already assessed this.
        </p>
      </section>

      <section>
        <h2>Button switches</h2>
        <p>
          A large flat disc, typically 65&ndash;125 mm across, that clicks when pressed
          anywhere on its surface. This is the default for good reason: a big target
          tolerates imprecise aim, the click gives feedback, and it can be mounted flat
          on a tray or angled on a stand.
        </p>
        <p>
          Watch the activation force. A stiff button that needs a deliberate shove will
          exhaust a child with low tone within minutes.
        </p>
      </section>

      <section>
        <h2>Lever switches</h2>
        <p>
          A paddle or wobble arm that moves sideways rather than being pressed down.
          Useful where a child sweeps or bats rather than pressing, and where a downward
          press is difficult — for instance from a reclined position. Because the arm
          moves through an arc, it can be caught anywhere along its length.
        </p>
      </section>

      <section>
        <h2>Proximity switches</h2>
        <p>
          No contact and no force at all: the switch triggers when a hand, cheek or head
          comes within a few centimetres. The right answer for a child whose movement is
          too weak or too painful for any mechanical switch. The trade-off is feedback —
          there is no click, so the toy&apos;s own response has to be immediate and
          obvious, and accidental triggers are easy.
        </p>
      </section>

      <section>
        <h2>Grasp and squeeze switches</h2>
        <p>
          A soft bulb or pad activated by closing a hand around it. Suits a child with a
          reliable grasp reflex but poor reach, and it can be held rather than mounted,
          which sidesteps the mounting problem entirely.
        </p>
      </section>

      <section>
        <h2>Mounting is half the job</h2>
        <p>
          A well-chosen switch in the wrong place is a switch the child cannot use. It
          needs to be exactly where their movement naturally lands, stay there when
          knocked, and be repeatable tomorrow. Gooseneck mounts, hook-and-loop on a tray,
          and a non-slip base all beat holding it in place by hand.
        </p>
      </section>

      <section>
        <h2>Where to get them</h2>
        <p>
          Commercial assistive switches cost anywhere from $40 to several hundred. Many
          designs can be printed and built for a fraction of that — see
          <Link href="/learn/3d-printing-basics"> 3D printing basics</Link> and the
          <Link href="/library"> Guides</Link>. Whatever you use, standardise on a
          3.5 mm mono plug so switches and toys stay interchangeable.
        </p>
      </section>
    </ProsePage>
  )
}
