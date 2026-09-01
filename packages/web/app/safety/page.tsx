import Link from 'next/link'
import { ProsePage, PullQuote } from '@/components/prose-page'

export const metadata = { title: 'Safety — SPLAT Connect' }

export default function SafetyPage() {
  return (
    <ProsePage
      title="Safety"
      lastUpdated="19 August 2026"
      intro="Adapting a toy means opening it, working near batteries, and handing the result to a child who may explore it with their mouth. None of that is dangerous if you know what to watch for."
    >
      <PullQuote>
        If a part fits inside a toilet roll tube, it fits inside a child. That single test catches most of what goes wrong.
      </PullQuote>
      <section>
        <h2>Batteries</h2>
        <ul>
          <li>
            <strong>Button cell and coin cell batteries are the most serious hazard on
            this page.</strong> Swallowed, they can cause severe internal burns within
            hours. If a toy uses one, the compartment must close with a screw, and you
            must check that screw is present and tight before handover. If you cannot
            secure it, do not adapt that toy.
          </li>
          <li>
            Never adapt a toy that runs on mains power or has a mains adapter. Stick to
            AA, AAA, C and D cells, or a screw-secured button cell.
          </li>
          <li>
            Do not mix old and new cells, or different chemistries, in the same toy.
          </li>
          <li>
            The screw-secured compartment is not just good practice. Australia&apos;s
            mandatory toy safety standard requires that toys for children up to 36
            months keep small parts and batteries behind a fastening that needs a tool
            to open. That is law, not advice.
          </li>
          <li>
            A battery interrupter goes between one battery and its contact. It does not
            change the toy&apos;s voltage and must never be used to connect a toy to
            anything other than a switch.
          </li>
        </ul>
      </section>

      <section>
        <h2>Small parts</h2>
        <ul>
          <li>
            Screws, springs, cable ties, offcuts of wire and 3D-printed fragments are
            all choking hazards. Work over a tray, and count screws back in.
          </li>
          <li>
            If the child will mouth the toy, avoid adaptations that add anything
            smaller than a 35 mm cylinder — the standard small-parts test size — that
            can come loose.
          </li>
          <li>
            Trim cable ties flush. A cut tie end is sharp.
          </li>
        </ul>
      </section>

      <section>
        <h2>Wiring and soldering</h2>
        <ul>
          <li>
            A soldering iron tip runs at around 350°C and will burn you before you
            feel it. Use a weighted stand, and put the iron back every single time.
          </li>
          <li>
            Use lead-free solder. If you&apos;re working anywhere near children, this
            isn&apos;t optional.
          </li>
          <li>
            Solder in a ventilated space, away from children and pets, with a fume
            absorber if you have one — flux fumes irritate the airways, and repeated
            exposure can cause occupational asthma. Let the iron cool in its stand
            before you move it.
          </li>
          <li>
            Safety glasses, for everyone at the bench including anyone watching.
            Clipped component leads fly.
          </li>
          <li>Wash your hands before you eat. No food or drink at the bench.</li>
          <li>
            For a burn: cool running water for 20 minutes. Not ice, not butter, not
            creams. Get medical help for anything bigger than a 20-cent coin, anything
            on the face or hands, and anything on a child.
          </li>
          <li>
            Insulate every joint with heat-shrink or tape. Bare copper inside a toy
            that gets shaken will eventually short.
          </li>
          <li>
            Strain-relieve the cable where it leaves the toy body, so pulling on the
            switch lead cannot tear the joint out.
          </li>
          <li>
            Use 3.5 mm mono sockets, the standard across assistive switches, so the toy
            works with switches the family may already own.
          </li>
        </ul>
      </section>

      <section>
        <h2>3D-printed parts</h2>
        <ul>
          <li>
            Sand or file every printed edge that a hand will touch. Layer lines are
            sharper than they look.
          </li>
          <li>
            Printed parts are not food safe and should not go in a dishwasher — heat
            will deform PLA. Wipe with warm soapy water instead.
          </li>
          <li>
            Print at a high enough infill that a part cannot snap into shards. Guides
            state their recommended settings; follow them.
          </li>
        </ul>
      </section>

      <section>
        <h2>Before you hand a toy over</h2>
        <ul>
          <li>Shake it hard. Listen for anything loose inside.</li>
          <li>Check every screw, especially the battery compartment.</li>
          <li>Pull firmly on the switch lead. It should not move at the toy end.</li>
          <li>Wipe the outside down, and tell the family how to clean it.</li>
          <li>
            Say what you changed. A parent needs to know there is a modified battery
            compartment in there.
          </li>
        </ul>
      </section>

      <section>
        <h2>Supervision</h2>
        <p>
          An adapted toy is still a toy, with the manufacturer&apos;s age rating and
          the same supervision needs as before — plus the changes you made. Nothing on
          this site replaces a clinician&apos;s advice about what is appropriate for a
          particular child.
        </p>
      </section>

      <section>
        <h2>If something goes wrong</h2>
        <p>
          Tell us. If a published guide has a safety problem,
          <Link href="/contact"> contact us</Link> and we will take it down while we
          check. We would much rather pull a guide than leave a hazard up.
        </p>
      </section>
    </ProsePage>
  )
}
