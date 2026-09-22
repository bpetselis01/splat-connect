/**
 * Printing basics — the page you hand to whoever owns the printer.
 *
 * The board's shape: the eight settings first, as a grid somebody reads
 * standing at the machine, then the three filaments as tinted cards, then the
 * finishing list. It was a ProsePage with an illustration and two extra prose
 * sections; the board has neither, and "hand this page to whoever owns the
 * printer" is an argument for the numbers leading.
 */
export const metadata = {
  title: '3D printing basics — SPLAT Connect',
  description: 'Filament, settings and finishing for printed switch parts.',
}

const SETTINGS = [
  ['Layer height', '0.2 mm'],
  ['Walls', '3'],
  ['Infill', '25%'],
  ['Nozzle', '210 °C'],
  ['Bed', '60 °C'],
  ['Supports', 'Touching bed'],
  ['Tolerance', '+0.2 mm'],
  ['Print time', '~40 min'],
]

const FILAMENTS = [
  {
    name: 'PLA',
    use: 'Most parts',
    note: 'Cheap, stiff, prints anywhere. Softens in a hot car — fine for indoor play.',
    tint: 'var(--tmint)',
  },
  {
    name: 'PETG',
    use: 'Anything clamped',
    note: 'Tougher and heat-safe. Use for tray mounts and anything that flexes in service.',
    tint: 'var(--b100)',
  },
  {
    name: 'TPU',
    use: 'Contact surfaces',
    note: 'Flexible. Good for pads and grips against skin; slow to print, worth it.',
    tint: 'var(--tcoral)',
  },
]

export default function PrintingBasics() {
  return (
    <article className="max-w-[900px]">
      <p className="eyebrow text-apricot">3D Printing</p>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Printing basics
      </h1>
      <p className="mt-4 max-w-[60ch] text-[19px] leading-[1.6] text-muted">
        Filament, settings and finishing for printed switch parts. Hand this page to whoever owns
        the printer.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {SETTINGS.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--radius-inset)] border border-line bg-surface p-[18px] shadow-[var(--e1)]"
          >
            <dt className="eyebrow text-muted">{label}</dt>
            <dd className="mt-1.5 font-display text-[22px] font-extrabold tabular-nums text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-2.5 mt-10 font-display text-[25px] font-extrabold text-ink">
        Which filament
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {FILAMENTS.map((f) => (
          <div
            key={f.name}
            className="rounded-card border border-line p-[22px] text-[var(--tink)]"
            style={{ background: f.tint }}
          >
            <h3 className="mb-1 font-display text-xl font-extrabold">{f.name}</h3>
            <p className="mb-2.5 text-[13px] font-bold opacity-70">{f.use}</p>
            <p className="text-sm leading-[1.5]">{f.note}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 mt-[38px] font-display text-[25px] font-extrabold text-ink">
        Finishing — the part people skip
      </h2>
      <ul className="flex max-w-[66ch] list-disc flex-col gap-2.5 pl-5 text-ink">
        <li>
          Deburr every hole. A printed edge is sharper than it looks and this part touches a child.
        </li>
        <li>No exposed supports on any face that meets skin.</li>
        <li>Wipe with isopropyl before handover; layer lines hold everything.</li>
        {/* Not on the board; kept because these parts go in children's mouths. */}
        <li>
          Printed parts are porous and not food safe. Clean with warm soapy water, never a
          dishwasher. If a part will be mouthed regularly, use a commercial smooth part instead.
        </li>
        <li>
          Print a test bracket in the cheapest filament first. Fit fails at the tolerance, not the
          geometry.
        </li>
      </ul>
    </article>
  )
}
