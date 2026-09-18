import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'
import { LearnShell } from '@/components/learn-shell'

export const metadata = {
  title: 'Tools and materials — SPLAT Connect',
  description: 'The shopping list, and what you can borrow instead of buying.',
}

export default function ToolsAndMaterials() {
  return (
    <LearnShell slug="tools-and-materials">
      <ProsePage
      title="Tools and materials"
      intro="Buy these once and you can adapt any number of toys. Every build lists what is specific to it on top of what is here."
    >
      {/*
        The kit, as a table — ITEM | WHAT IT IS FOR | WHERE · QTY · COST, with a
        total row. The board leads this page on it rather than on prose, and it
        is the right call: somebody reading this is about to spend money, and a
        bulleted essay does not add up to $288.15.
      */}
      <section>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Item</th>
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">What it is for</th>
                <th scope="col" className="eyebrow whitespace-nowrap pb-2 text-right text-muted">
                  Where · Qty · Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Soldering station (iron + heat gun)', 'Iron joins the wires to the circuit; the heat gun shrinks the insulation over the joint.', 'Jaycar', '1', '$87.95'],
                ['Fume extraction fan', 'Filters solder fumes. Sit it as close to the work as you can — room ventilation is still needed.', 'Jaycar', '1', '$79.95'],
                ['Helping hands', 'Clamps that hold the part while you solder, so you are never holding hot metal.', 'Jaycar', '1', '$14.95'],
                ['Wire strippers', 'Takes the PVC off the wire and leaves the copper strands intact.', 'Jaycar', '1', '$24.95'],
                ['Pliers', 'Holding parts that get hot, and bending switch legs to 90°.', 'Jaycar', '1', '$16.50'],
                ['Screwdriver set', 'Opening toys. Size and head shape depend on the toy — triangular heads turn up more than you would think.', 'Bunnings', '1', '$4.95'],
                ['Multimeter', 'Continuity mode proves a joint works before you close the toy up. The single most useful thing for diagnosing a build that will not go.', 'Jaycar', '1', '$33.95'],
                ['Heat-proof mat', 'Silicone mat under the work so you do not burn the kitchen table.', 'Jaycar', '1', '$24.95'],
              ].map(([item, why, shop, qty, cost]) => (
                <tr key={item} className="border-b border-line align-top">
                  <td className="py-3 pr-3 font-bold text-ink">{item}</td>
                  <td className="py-3 pr-3 text-sm leading-relaxed text-muted">{why}</td>
                  <td className="whitespace-nowrap py-3 text-right">
                    <span className="block font-mono text-sm font-bold tabular-nums text-ink">
                      {cost}
                    </span>
                    <span className="block text-xs text-muted">
                      {shop} · {qty}
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-3 font-bold text-ink" colSpan={2}>
                  Full kit, bought new
                </td>
                <td className="whitespace-nowrap py-3 text-right font-mono text-sm font-bold tabular-nums text-ink">
                  $288.15
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Prices are indicative and change. Everything here is stocked by Jaycar and
          Bunnings because they are the easiest to reach — online stores and sales are
          usually cheaper if you can wait. Read the next lesson on{' '}
          <Link href="/learn/safety-and-cleaning">safe handling</Link> before you use any
          of it.
        </p>
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
        <h2>Borrow before you buy</h2>
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
    </LearnShell>
  )
}
