import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Tools and materials — SPLAT Connect',
  description: 'The shopping list, and what you can borrow instead of buying.',
}

export default function ToolsAndMaterials() {
  return (
    <ProsePage
      title="Tools and materials"
      intro="A first adaptation needs surprisingly little. Here is what actually gets used, separated from what a hobby electronics shop will try to sell you."
    >
      <section>
        <h2>The minimum</h2>
        <ul>
          <li>
            <strong>A small Phillips screwdriver set.</strong> Toy screws are tiny, and
            often recessed down a narrow shaft. This is the tool you will reach for on
            every single build.
          </li>
          <li>
            <strong>Wire strippers,</strong> or a sharp pair of side cutters and
            patience.
          </li>
          <li>
            <strong>Stranded hook-up wire, 22&ndash;24 AWG.</strong> Stranded, not solid:
            solid core work-hardens and snaps where it flexes.
          </li>
          <li>
            <strong>3.5 mm mono sockets.</strong> Buy ten; they cost very little and you
            will use them all.
          </li>
          <li>
            <strong>Heat-shrink tubing</strong> in two or three diameters. Insulating
            tape works but comes unstuck inside a toy that gets shaken.
          </li>
        </ul>
      </section>

      <section>
        <h2>Soldering, when you get to it</h2>
        <p>
          A temperature-controlled iron around 30&ndash;60 W, 60/40 or lead-free rosin-core
          solder, a brass-wool tip cleaner, and a stand. A cheap fixed-temperature iron
          will do a first build, but it will also lift pads and melt plastic, so it is a
          false economy if you plan more than one.
        </p>
        <p>
          Helping hands or a small vice are not optional in practice — two hands are
          already committed to the iron and the solder.
        </p>
      </section>

      <section>
        <h2>Nice to have</h2>
        <ul>
          <li>
            <strong>A multimeter.</strong> Continuity mode alone will save you an hour
            per build. It answers &ldquo;is this joint actually connected&rdquo; without
            guessing.
          </li>
          <li>
            <strong>A plastic spudger or guitar pick,</strong> for opening clipped cases
            without gouging them.
          </li>
          <li>
            <strong>A parts tray with compartments.</strong> Toy screws are different
            lengths and go back in specific holes.
          </li>
          <li>
            <strong>Cable ties</strong> for strain relief, trimmed flush.
          </li>
        </ul>
      </section>

      <section>
        <h2>Battery interrupters</h2>
        <p>
          Buy them, or print them. Commercial ones cost a few dollars each and work
          immediately. Printed ones need a thin conductive contact — copper tape or a
          trimmed brass shim — and are worth it if you are doing many builds. Sizes are
          per battery type, so a AA interrupter will not fit a AAA compartment.
        </p>
      </section>

      <section>
        <h2>What to borrow rather than buy</h2>
        <p>
          A 3D printer is the big one. Libraries, makerspaces, men&apos;s sheds, schools
          and universities often have one and are usually delighted to be asked. Some
          SPLAT <Link href="/organizations">organisations</Link> hold printers for
          exactly this. You do not need to own a printer to build a printed switch — see
          <Link href="/printing/basics"> 3D printing basics</Link>.
        </p>
      </section>

      <section>
        <h2>Per-guide parts lists</h2>
        <p>
          Every guide in the <Link href="/library">Guides</Link> library lists its own
          parts with links to buy them, so you do not have to work out quantities. Read
          the list before you start, not halfway through.
        </p>
      </section>
    </ProsePage>
  )
}
