import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Safety and cleaning — SPLAT Connect',
  description: 'Batteries, small parts, and getting a toy ready to hand over.',
}

export default function SafetyAndCleaning() {
  return (
    <ProsePage
      title="Safety and cleaning"
      intro="This article is the practical companion to the site's formal safety page. Read both before your first handover."
    >
      <section>
        <h2>The three that actually hurt children</h2>
        <ul>
          <li>
            <strong>Button and coin cells.</strong> Swallowed, they burn through tissue
            within hours. The compartment must close with a screw, and that screw must be
            in and tight. If it does not screw shut, do not adapt the toy.
          </li>
          <li>
            <strong>Loose small parts.</strong> Screws, springs, trimmed wire ends and
            printed fragments. Work over a tray, count screws out and back in, and shake
            the finished toy hard next to your ear.
          </li>
          <li>
            <strong>Mains power.</strong> Never. Battery toys only.
          </li>
        </ul>
      </section>

      <section>
        <h2>Making a joint that survives a child</h2>
        <p>
          The failure mode is always the same: someone pulls the switch lead and the wire
          tears out of the toy, leaving bare copper inside a rattling plastic shell. Two
          habits prevent it. Insulate every joint with heat-shrink rather than tape, and
          strain-relieve the cable where it exits the case — a cable tie or a knot inside
          the shell, so a pull is taken by the case and not by the solder.
        </p>
      </section>

      <section>
        <h2>Cleaning an adapted toy</h2>
        <p>
          Assume the toy will go in a mouth. Wipe hard surfaces with warm soapy water or
          an alcohol wipe, and let them dry fully before the batteries go back. Never
          submerge an adapted toy, and never put printed parts in a dishwasher — PLA
          deforms well below dishwasher temperature.
        </p>
        <p>
          Fabric toys are harder. If the electronics are in a removable pod, wash the
          fabric and keep the pod out. If they are sewn in, tell the family it is
          surface-clean only, because they will otherwise find out the expensive way.
        </p>
      </section>

      <section>
        <h2>Printed parts specifically</h2>
        <p>
          Sand or file every edge a hand will touch — layer lines are sharper than they
          look. Print at an infill high enough that a part cannot snap into shards; the
          guide will state a figure. Printed plastic is porous and not food safe, so
          anything a child mouths regularly should be a smooth commercial part rather
          than a printed one.
        </p>
      </section>

      <section>
        <h2>The handover checklist</h2>
        <ul>
          <li>Shake it. Listen for anything loose.</li>
          <li>Check every screw, battery compartment first.</li>
          <li>Pull the switch lead firmly. Nothing should move at the toy end.</li>
          <li>Test it with the actual switch the child will use.</li>
          <li>Wipe it down.</li>
          <li>
            Say what you changed, and how to clean it. A parent needs to know there is a
            modified battery compartment in there.
          </li>
        </ul>
        <p>
          The full formal guidance, including what to do if you find a problem with a
          published guide, is on the <Link href="/safety">safety page</Link>.
        </p>
      </section>
    </ProsePage>
  )
}
