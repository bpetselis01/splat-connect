// Registry ids → Phosphor icons for the Not built yet tile. Anything unlisted
// gets the hourglass the board uses; the registry stays icon-free because the
// phone uses Ionicons.
import type { Icon } from '@phosphor-icons/react'
import { Hourglass, MapTrifold, Cube, ChatCircleDots, Heart, Flag } from '@phosphor-icons/react/dist/ssr'

const ICONS: Record<string, Icon> = {
  'impact-map': MapTrifold,
  'saved-parts': Cube,
  'makers-ask-first': ChatCircleDots,
  'thank-people': Heart,
  'report-problem-mobile': Flag,
}

export const pendingIcon = (id: string): Icon => ICONS[id] ?? Hourglass
