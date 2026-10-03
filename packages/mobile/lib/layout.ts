import { theme } from './theme'

export const SCREEN_GUTTER = theme.spacing(4)
export const SEARCH_GAP = theme.spacing(4)

/** `style` for a vertical ScrollView or FlatList inside a padded `Screen`: the
 *  frame spans the screen so it does not clip the cards' shadows at the gutter. */
export const scrollFrame = { marginHorizontal: -SCREEN_GUTTER } as const
/** The matching `contentContainerStyle` part: puts the gutter back inside. */
export const scrollContent = { paddingHorizontal: SCREEN_GUTTER } as const
