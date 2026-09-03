// packages/mobile/components/ui/FilterSheet.tsx
//
// One filter trigger beside the search field, opening the platform's own
// sheet — SwiftUI on iOS, Material on Android, a vaul drawer on web — via
// @expo/ui's drop-in BottomSheet. Replaces the two chip rows that used to sit
// under the search on Guides and Toy Library and pushed the first result below
// the fold. The chip rows themselves are unchanged: they are the children.
//
// The sheet is the platform's, so the scrim, grabber and spring are the
// platform's too — the same grabber the Add-a-guide formSheet already shows.
// What the app owns is the trigger, which borrows the CornerMenu's box and
// its Jersey-10 count pill so a closed sheet still says the list is narrowed.
import { useRef, type ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'
import { Button } from './Button'

export function FilterSheet({ count, children }: { count: number; children: ReactNode }) {
  const sheet = useRef<BottomSheetModal>(null)

  return (
    <>
      <AnimatedPressable
        onPress={() => sheet.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={count ? `Filters, ${count} active` : 'Filters'}
        style={styles.trigger}
      >
        <Ionicons name="options-outline" size={24} color={theme.colors.ink} />
        {count ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </AnimatedPressable>
      {/* Modal variant: always starts closed, so no index bookkeeping. */}
      <BottomSheetModal ref={sheet} enablePanDownToClose backgroundStyle={styles.sheet}>
        <BottomSheetView style={styles.body}>
          <Text style={styles.title}>Filters</Text>
          {children}
          <Button label="Done" onPress={() => sheet.current?.dismiss()} style={styles.done} />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  )
}

const styles = StyleSheet.create({
  // Same box as the CornerMenu trigger, minus the apricot: this is a filter,
  // not the screen's one create action.
  trigger: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(4),
  },
  countPill: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 22,
    paddingHorizontal: theme.spacing(1),
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.mintSoft,
    alignItems: 'center',
  },
  countText: { fontFamily: theme.fonts.numeral, fontSize: 17, color: theme.colors.mintDeep },
  sheet: { backgroundColor: theme.colors.background },
  body: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(8),
    gap: theme.spacing(2),
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.ink,
    marginBottom: theme.spacing(2),
  },
  done: { marginTop: theme.spacing(2) },
})
