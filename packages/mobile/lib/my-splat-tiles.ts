// The six things a person comes back for. Web hrefs, deliberately: the hub
// and the popover share lib/my-routes.ts to turn them into screens.
import type { Ionicons } from '@expo/vector-icons'
import type { Capabilities } from '@splat-connect/types'

export type Tile = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string; count?: number }

const count = (n: number) => (n > 0 ? n : undefined)

export function popoverTiles(caps: Capabilities): Tile[] {
  const second: Tile = caps.ledOrgs.length
    ? { label: 'Review queue', icon: 'file-tray-full-outline', href: '/dashboard/organisation' }
    : { label: 'Design challenges', icon: 'bulb-outline', href: '/dashboard/challenges', count: count(caps.unread.challenges) }
  return [
    { label: 'My exchanges', icon: 'swap-horizontal-outline', href: '/dashboard/exchanges', count: count(caps.exchangeActions) },
    second,
    { label: 'My toys', icon: 'cube-outline', href: '/dashboard/toys' },
    { label: 'My tutorials', icon: 'book-outline', href: '/dashboard/tutorials' },
    { label: 'Saved', icon: 'bookmark-outline', href: '/dashboard/saved' },
    { label: 'Account & child profiles', icon: 'person-outline', href: '/dashboard/profile' },
  ]
}
