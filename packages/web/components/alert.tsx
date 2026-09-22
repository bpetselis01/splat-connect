import type { ReactNode } from 'react'
import { Info, CheckCircle, Warning, WarningOctagon } from '@phosphor-icons/react/dist/ssr'

/**
 * A one-sentence inline notice. Never the place for instructions.
 *
 * From design-system-update/components/feedback/Alert.jsx: 14px 16px on
 * --radius-inset, the tone's tint behind a hairline, a fill icon at 18px, and
 * 14px/1.55 at weight 600.
 *
 * `bad` takes role="alert" and the others do not — a warning a reader walks past
 * is not worth interrupting a screen reader for, and announcing every tinted box
 * trains people to ignore the ones that matter.
 */
const TONE = {
  info: { bg: 'var(--color-brand-soft)', Icon: Info },
  ok: { bg: 'var(--color-success-soft)', Icon: CheckCircle },
  warn: { bg: 'var(--color-honey-soft)', Icon: Warning },
  bad: { bg: 'var(--color-danger-soft)', Icon: WarningOctagon },
} as const

export type AlertTone = keyof typeof TONE

export function Alert({
  tone = 'info',
  icon,
  children,
  className = '',
}: {
  tone?: AlertTone
  /** Override the tone's default glyph where the subject has its own. */
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const { bg, Icon } = TONE[tone]
  return (
    <div
      role={tone === 'bad' ? 'alert' : undefined}
      className={`flex items-start gap-3 rounded-[var(--radius-inset)] border border-line p-[14px_16px] text-sm font-semibold leading-[1.55] text-ink ${className}`.trim()}
      style={{ backgroundColor: bg }}
    >
      <span aria-hidden="true" className="mt-px shrink-0">
        {icon ?? <Icon weight="fill" size={18} />}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
