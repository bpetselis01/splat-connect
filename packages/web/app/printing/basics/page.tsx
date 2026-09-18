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
      title="Printing basics"
      intro="Many switches, mounts and battery interrupters on this site are printed. You do not need to own a printer, and you do not need to understand slicing deeply — just enough to get a part that holds up."
    >
      <EditorialImage illustration="printer" ratio="2/1" />

      {/*
        The settings grid, straight off the board. Eight numbers somebody reads
        standing at a printer, so they are a scannable grid rather than the
        prose bullets this page used to bury them in — the board's intro says
        "hand this page to whoever owns the printer", and that is the whole
        design of it.
      */}
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
        <ul className="mt-3 flex list-none flex-col gap-3 pl-0">
          {[
            ['PLA', 'Most parts', 'Cheap, stiff, prints anywhere. Softens in a hot car — fine for indoor play.'],
            ['PETG', 'Anything clamped', 'Tougher and heat-safe. Use for tray mounts and anything that flexes in service.'],
            ['TPU', 'Contact surfaces', 'Flexible. Good for pads and grips against skin; slow to print, worth it.'],
          ].map(([name, role, why]) => (
            <li key={name} className="card p-4">
              <p className="card-title">{name}</p>
              <p className="eyebrow mt-0.5 text-muted">{role}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {/*
          Eight numbers somebody reads standing at a printer, so the board draws
          them as a scannable grid rather than the prose bullets this page used
          to bury them in. Its intro says "hand this page to whoever owns the
          printer", and that is the whole design of the screen.
        */}
        <h2>Settings that matter</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Layer height', '0.2 mm'],
            ['Walls', '3'],
            ['Infill', '25%'],
            ['Nozzle', '210 °C'],
            ['Bed', '60 °C'],
            ['Supports', 'Touching bed'],
            ['Tolerance', '+0.2 mm'],
            ['Print time', '~40 min'],
          ].map(([label, value]) => (
            <div key={label} className="card p-4">
              <dt className="eyebrow text-muted">{label}</dt>
              <dd className="numeral mt-1.5 text-[22px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>Finishing — the part people skip</h2>
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
