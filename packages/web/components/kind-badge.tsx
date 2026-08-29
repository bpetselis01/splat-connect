import { KIND_LABEL, type TutorialKind } from '@splat-connect/types'

/** Which walk a tutorial is on, beside the DifficultyBadge wherever that shows. */
export function KindBadge({ kind }: { kind: TutorialKind }) {
  return <span className="badge bg-sunken text-brand-deep">{KIND_LABEL[kind]}</span>
}
