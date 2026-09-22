import Link from 'next/link'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'
import { LearnShell } from '@/components/learn-shell'
import { KitTable, LessonH2, type KitRow } from '@/components/lesson-kit'

export const metadata = {
  title: 'Tools and materials — SPLAT Connect',
  description: 'The shopping list, and what you can borrow instead of buying.',
}

// The workshop's own kit list, with its own product shots. Two tables because
// the costs mean different things: equipment is bought once, consumables are
// priced per unit and used up.
const EQUIPMENT: KitRow[] = [
  { item: 'Soldering station (iron + heat gun)', why: 'Iron joins the wires to the circuit; the heat gun shrinks the insulation over the joint.', shop: 'Jaycar', qty: '1', cost: '$87.95', img: '/learn/img/04.jpeg' },
  { item: 'Fume extraction fan', why: 'Filters solder fumes. Sit it as close to the work as you can — room ventilation is still needed.', shop: 'Jaycar', qty: '1', cost: '$79.95', img: '/learn/img/05.jpeg' },
  { item: 'Helping hands', why: 'Clamps that hold the part while you solder, so you are never holding hot metal.', shop: 'Jaycar', qty: '1', cost: '$14.95', img: '/learn/img/06.png' },
  { item: 'Wire strippers', why: 'Takes the PVC off the wire and leaves the copper strands intact.', shop: 'Jaycar', qty: '1', cost: '$24.95', img: '/learn/img/07.png' },
  { item: 'Pliers', why: 'Holding parts that get hot, and bending switch legs to 90°.', shop: 'Jaycar', qty: '1', cost: '$16.50', img: '/learn/img/08.png' },
  { item: 'Screwdriver set', why: 'Opening toys. Size and head shape depend on the toy — triangular heads turn up more than you would think.', shop: 'Bunnings', qty: '1', cost: '$4.95', img: '/learn/img/09.jpeg' },
  { item: 'Multimeter', why: 'Continuity mode proves a joint works before you close the toy up. The single most useful thing for diagnosing a build that will not go.', shop: 'Jaycar', qty: '1', cost: '$33.95', img: '/learn/img/10.jpeg' },
  { item: 'Heat-proof mat', why: 'Silicone mat under the work so you do not burn the kitchen table.', shop: 'Jaycar', qty: '1', cost: '$24.95', img: '/learn/img/11.jpeg' },
]

const CONSUMABLES: KitRow[] = [
  { item: 'Solder', why: 'Joins wire to circuit board.', shop: 'Jaycar', qty: '15 g', cost: '$4.55', img: '/learn/img/12.jpeg' },
  { item: 'Heat shrink, 1.5 mm', why: 'Covers small exposed wires and solder points.', shop: 'Jaycar', qty: '1.2 m', cost: '$1.55', img: '/learn/img/13.jpeg' },
  { item: 'Heat shrink, 2.5 mm', why: 'Covers larger joints — you want one of each size per connector.', shop: 'Jaycar', qty: '1.2 m', cost: '$1.75', img: '/learn/img/13.jpeg' },
  { item: 'Light-duty speaker cable', why: 'The wire between switch and socket. Toys need about 10 cm; switches need 1–2 m.', shop: 'Jaycar', qty: '1 m', cost: '$0.70', img: '/learn/img/14.jpeg' },
  { item: '3.5 mm mono socket', why: 'Goes in the toy. This is what a jelly bean switch plugs into.', shop: 'Jaycar', qty: 'each', cost: '$0.95', img: '/learn/img/19.jpeg' },
  { item: '3.5 mm mono jack', why: 'Goes on the switch. The standard across every accessible interface.', shop: 'Jaycar', qty: 'each', cost: '$1.95', img: '/learn/img/18.jpeg' },
  { item: 'Flux', why: 'Helps solder flow. Makes a first solder joint much more forgiving.', shop: 'Jaycar', qty: '10 g', cost: '$16.95', img: '/learn/img/15.png', optional: true },
]

export default function ToolsAndMaterials() {
  return (
    <LearnShell slug="tools-and-materials">
      <div className="mt-[26px] flex items-start gap-3 rounded-[var(--radius-inset)] border border-line bg-[var(--tamber)] px-5 py-4">
        <WarningCircle size={24} weight="fill" className="flex-none text-[var(--tink)]" aria-hidden="true" />
        <p className="text-[15px] font-semibold leading-[1.55] text-[var(--tink)]">
          Prices are indicative and change. Everything here is stocked by Jaycar and Bunnings because
          they are the easiest to reach — online stores and sales are usually cheaper if you can wait.
          Read the next lesson on{' '}
          <Link href="/learn/safety-and-cleaning" className="font-extrabold text-[var(--tink)]!">
            safe handling
          </Link>{' '}
          before you use any of it.
        </p>
      </div>

      <div className="mt-[26px]">
        <KitTable
          rows={EQUIPMENT}
          head={['Item', 'What it is for', 'Where · qty · cost']}
          caption={{
            title: 'Equipment — buy once, adapt anything',
            sub: 'One-off purchases. Borrow before you buy where you can.',
          }}
          total={{ label: 'Full kit, bought new', value: '$288.15' }}
          photoFit="contain"
        />
      </div>
      <div className="mt-[22px]">
        <KitTable
          rows={CONSUMABLES}
          head={['Material', 'What it is for', 'Where · unit · cost']}
          caption={{
            title: 'Consumables — used up as you go',
            sub: 'Sold by length or weight, so the cost is per unit, not per toy.',
          }}
          photoFit="contain"
        />
      </div>

      <LessonH2 className="mb-2.5 mt-[38px]">Borrow before you buy</LessonH2>
      <p className="max-w-[66ch] leading-[1.6] text-ink">
        A soldering iron used twice a year is a waste of a bench. Libraries, makerspaces, men&apos;s
        sheds and school tech rooms have them, and most will let you use one with ten minutes of
        supervision. The same places usually own the 3D printer you need for a switch mount — see{' '}
        <Link href="/printing">3D Printing</Link>.
      </p>
    </LearnShell>
  )
}
