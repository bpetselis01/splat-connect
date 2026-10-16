// packages/mobile/components/organisation/acting-org-switcher.tsx
//
// The "Acting for <org>" pill at the head of Me's Organisation group, and the
// sheet it opens. Only a person who leads two or more organisations sees it.
// On iOS the sheet is a native page sheet with the ScrollView as its direct
// child (a native sheet clips one that is not); elsewhere it is a bottom panel.
import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Organization } from '@splat-connect/types'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { theme } from '../../lib/theme'

const TINTS = [theme.colors.accentLight, theme.colors.apricotSoft]
const HINT = "Events, stories, orders, inventory, recycling and your organisation's profile follow the one you pick."

function OrgIcon({ index }: { index: number }) {
  return (
    <View style={[styles.orgIcon, { backgroundColor: TINTS[index % TINTS.length] }]}>
      <Ionicons name="business-outline" size={18} color={theme.colors.ink} />
    </View>
  )
}

function Options({ orgs, current, onPick }: { orgs: Organization[]; current: string; onPick: (id: string) => void }) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.sheetTitle}>Act for which organisation?</Text>
      <Text style={styles.sheetHint}>{`You lead ${orgs.length === 2 ? 'both' : 'all'}. ${HINT}`}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {orgs.map((o, i) => {
          const on = o.id === current
          return (
            <AnimatedPressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.name}
              pressScale={0.98}
              onPress={() => onPick(o.id)}
              style={[styles.opt, on && styles.optOn]}
            >
              <OrgIcon index={i} />
              <View style={styles.flex}>
                <Text style={styles.optName}>{o.name}</Text>
                <Text style={styles.optMeta}>Leader</Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={24} color={theme.colors.primaryDark} /> : null}
            </AnimatedPressable>
          )
        })}
      </View>
    </>
  )
}

export function ActingOrgSwitcher({
  orgs,
  current,
  onPick,
}: {
  orgs: Organization[]
  current: string | undefined
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (orgs.length < 2) return null
  const index = Math.max(0, orgs.findIndex((o) => o.id === current))
  const org = orgs[index]
  const pick = (id: string) => {
    onPick(id)
    setOpen(false)
  }
  const close = () => setOpen(false)

  return (
    <>
      <AnimatedPressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Acting for ${org.name}. Change organisation.`}
        accessibilityState={{ expanded: open }}
        style={styles.pill}
      >
        <OrgIcon index={index} />
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>Acting for</Text>
          <Text style={styles.name} numberOfLines={1}>{org.name}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.colors.muted} />
      </AnimatedPressable>

      {Platform.OS === 'ios' ? (
        <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close} onDismiss={close}>
          <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} onAccessibilityEscape={close}>
            <View style={styles.grabber} />
            <Options orgs={orgs} current={org.id} onPick={pick} />
          </ScrollView>
        </Modal>
      ) : (
        <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
          <View style={styles.root}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={StyleSheet.absoluteFill} />
            <View accessibilityViewIsModal onAccessibilityEscape={close} style={styles.sheet}>
              <View style={styles.grabber} />
              <Options orgs={orgs} current={org.id} onPick={pick} />
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  orgIcon: { width: 36, height: 36, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.micro, color: theme.colors.muted },
  name: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(8),
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(4),
  },
  page: { flex: 1, backgroundColor: theme.colors.surface },
  pageContent: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(2), paddingBottom: theme.spacing(8) },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border, marginBottom: theme.spacing(4) },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, lineHeight: 26, color: theme.colors.ink },
  sheetHint: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.muted, marginTop: 2, marginBottom: theme.spacing(4) },
  options: { gap: 9 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 12,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentFaint },
  optName: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  optMeta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 1 },
})
