/**
 * The pieces Learn lessons are drawn from, as the board draws them: a lesson
 * heading, a photo slot, and the parts table that Tools and materials and
 * every build share.
 *
 * Kept together because the three read lessons and five build lessons repeat
 * them verbatim on the board; one definition keeps a 25px heading from being
 * 24 on one page and 26 on the next.
 */
import Image from 'next/image'
import { Image as ImageIcon, Package } from '@phosphor-icons/react/dist/ssr'

export function LessonH2({ children, className = 'mb-2 mt-[34px]' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-display text-[25px] font-extrabold text-ink ${className}`}>{children}</h2>
}

/**
 * Where the board holds a photograph the workshop has not taken yet. Saying
 * what the picture WILL be is more use than a grey rectangle, and the ratio is
 * fixed so the real photo drops in without reflowing the lesson.
 */
export function PhotoSlot({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-1.5 bg-[color-mix(in_srgb,var(--color-muted)_8%,transparent)] p-3 text-center text-[13px] font-medium text-muted ${className}`}
    >
      <ImageIcon size={28} className="opacity-45" aria-hidden="true" />
      <span className="max-w-[90%]">{label}</span>
    </div>
  )
}

export type KitRow = {
  item: string
  why: string
  shop: string
  /** "1", "2 pieces", "15 g" — the qty or the unit it is sold by. */
  qty: string
  cost: string
  img?: string
  optional?: boolean
}

/**
 * A shopping list, as a table: a builder compares rows, and a screen reader
 * gets column headers. The photo sits inside the first cell so the shape stays
 * the board's three columns.
 */
export function KitTable({
  rows,
  head,
  caption,
  total,
  photoFit = 'cover',
}: {
  rows: KitRow[]
  /** The three column headings. */
  head: [string, string, string]
  caption?: { title: string; sub: string }
  total?: { label: string; value: string }
  /** Product shots on white read better contained; bench photos fill. */
  photoFit?: 'cover' | 'contain'
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-[var(--e2)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          {caption && (
            <caption className="border-b border-line px-[22px] py-[18px] text-left">
              <span className="block font-display text-[19px] font-extrabold text-ink">{caption.title}</span>
              <span className="mt-[3px] block text-sm font-semibold text-muted">{caption.sub}</span>
            </caption>
          )}
          <thead>
            <tr className="bg-sunken text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="px-[22px] py-3">{head[0]}</th>
              <th scope="col" className="px-4 py-[13px]">{head[1]}</th>
              <th scope="col" className="px-[22px] py-3 text-right">{head[2]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.item} className="border-t border-line">
                <td className="px-[22px] py-[13px]">
                  <span className="flex items-center gap-3">
                    {k.img ? (
                      <span
                        aria-hidden="true"
                        className={`relative h-14 w-14 flex-none overflow-hidden rounded-[var(--radius-field)] bg-sunken ${photoFit === 'contain' ? 'p-1' : ''}`}
                      >
                        <span className="relative block h-full w-full">
                          <Image
                            src={k.img}
                            alt=""
                            fill
                            sizes="56px"
                            className={photoFit === 'contain' ? 'object-contain' : 'object-cover'}
                          />
                        </span>
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid h-14 w-14 flex-none place-items-center rounded-[var(--radius-field)] bg-sunken"
                      >
                        <Package size={24} weight="duotone" className="text-muted" />
                      </span>
                    )}
                    <span className="font-extrabold leading-[1.3] text-ink">
                      {k.item}
                      {k.optional && (
                        <span className="ml-2 rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-extrabold text-muted">
                          Optional
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-[13px] text-sm leading-normal text-muted">{k.why}</td>
                <td className="whitespace-nowrap px-[22px] py-[13px] text-right">
                  <span className="block text-sm font-bold text-ink">{k.shop}</span>
                  <span className="mt-[3px] block font-mono text-[13.5px] font-bold text-muted">
                    {k.qty} · {k.cost}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr className="bg-brand-tint text-[var(--tink)]">
                <td colSpan={2} className="px-[22px] py-3.5 font-extrabold">{total.label}</td>
                <td className="px-[22px] py-3.5 text-right font-mono text-sm font-extrabold">{total.value}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
