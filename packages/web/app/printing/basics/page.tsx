import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: '3D printing basics — SPLAT Connect',
  description: 'Filament, settings and finishing for printed switch parts.',
}

export default function PrintingBasics() {
  return (
    <ProsePage
      title="3D printing basics"
      intro="Many switches, mounts and battery interrupters on this site are printed. You do not need to own a printer, and you do not need to understand slicing deeply — just enough to get a part that holds up."
    >
      <EditorialImage illustration="printer" ratio="2/1" />

      <section>
        <h2>If you don&apos;t have a printer</h2>
        <p>
          Ask a library, a makerspace, a men&apos;s shed, a school or a university. Many
          have printers sitting idle and staff who would rather they were used for this
          than for another keyring. Some SPLAT <Link href="/organizations">organisations
          </Link> hold printers specifically for assistive parts. Hand over the STL file
          from the guide and the settings below; that is all a printer operator needs.
        </p>
      </section>

      <section>
        <h2>Which filament</h2>
        <ul>
          <li>
            <strong>PLA</strong> for most parts. Easy, cheap, dimensionally accurate,
            stiff enough for switch housings. Its weakness is heat — a PLA part left on a
            car dashboard will sag.
          </li>
          <li>
            <strong>PETG</strong> where a part flexes or takes repeated impact, such as a
            lever arm or a clamp. Tougher than PLA, slightly fussier to print, and it
            tolerates warmth.
          </li>
          <li>
            <strong>Avoid ABS</strong> unless you have an enclosed printer and good
            ventilation. The fumes are unpleasant and it warps badly.
          </li>
          <li>
            <strong>Avoid flexible filament</strong> for a first print. It needs a
            direct-drive extruder and a lot of patience.
          </li>
        </ul>
      </section>

      <section>
        <h2>Settings that matter</h2>
        <ul>
          <li>
            <strong>Layer height 0.2 mm.</strong> The default, and fine for everything
            here. Go finer only for a part with fine detail.
          </li>
          <li>
            <strong>Infill 30&ndash;40% for structural parts</strong>, and three or more
            perimeters. Strength in printed parts comes more from perimeters than from
            infill.
          </li>
          <li>
            <strong>Print orientation decides strength.</strong> Layers separate under
            load more readily than they break. Lay a lever flat so the stress runs along
            the layers, not across them.
          </li>
          <li>
            <strong>Supports</strong> only where the guide says. Every support leaves a
            surface you then have to clean up.
          </li>
        </ul>
      </section>

      <section>
        <h2>Finishing</h2>
        <p>
          File or sand every edge a child will touch. Remove supports fully, then check
          the part against the guide&apos;s photographs — a stray blob in a switch housing
          will stop it clicking. Test-fit before you glue or screw anything, because a
          part that is 0.2 mm out is easier to reprint than to force.
        </p>
      </section>

      <section>
        <h2>Cleaning and safety</h2>
        <p>
          Printed parts are porous and not food safe. Wipe with warm soapy water; never a
          dishwasher. If a part will be mouthed regularly, use a commercial smooth part
          instead. More in <Link href="/learn/safety-and-cleaning">safety and cleaning
          </Link>.
        </p>
      </section>
    </ProsePage>
  )
}
