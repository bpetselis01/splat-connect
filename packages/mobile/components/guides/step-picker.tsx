// packages/mobile/components/guides/step-picker.tsx
//
// "Which step?" for a guide with many steps (mockup option C, field and list
// sheet): a field showing "7. Fit the wheels" that opens a searchable list of
// "17  Seal with varnish" rows. A guide with five steps or fewer keeps chips,
// which are lighter than a list for three items. One picker serves the
// feedback sheet and the Feedback tab's filter.
import { useEffect, useRef, useState } from 'react'
import { View, Text, Modal, Pressable, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { TutorialStep } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'

/** Guides with this many steps or fewer pick with chips. */
export const CHIP_MAX = 5
const ROW_HEIGHT = 52

type StepLike = Pick<TutorialStep, 'id' | 'position' | 'title'>
type Row = { key: string; position: number | null; title: string; sub?: string }

export type StepPickerProps = {
  steps: StepLike[]
  /** undefined: nothing chosen; null: Missing step; n: step n. */
  value: number | null | undefined
  onChange: (position: number | null) => void
  /** The step the person was on when they opened the sheet. */
  hereStep?: number | null
  /** Small caps line above the field. */
  eyebrow?: string
  /** Names the field and the list sheet: "Which step". */
  title?: string
  placeholder?: string
  /** False: no Missing step row or chip (the filter has its own). */
  allowMissing?: boolean
  testID?: string
}

const stepTitle = (s: StepLike) => s.title?.trim() || 'Untitled step'

export function StepPicker(props: StepPickerProps) {
  const { steps, value, onChange, eyebrow, title = 'Which step', allowMissing = true } = props
  const [open, setOpen] = useState(false)

  if (steps.length <= CHIP_MAX) {
    return (
      <>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View accessibilityLabel={`${title} is it about?`} style={styles.chips}>
          {steps.map((s) => (
            <Chip key={s.id} label={`Step ${s.position}`} active={value === s.position} onPress={() => onChange(s.position)} />
          ))}
          {allowMissing ? <Chip label="Missing step" active={value === null} onPress={() => onChange(null)} /> : null}
        </View>
      </>
    )
  }

  const chosen = typeof value === 'number' ? steps.find((s) => s.position === value) : undefined
  const text = value === null ? 'Missing step' : chosen ? `${chosen.position}. ${stepTitle(chosen)}` : (props.placeholder ?? 'Choose a step')
  const here = props.hereStep != null && value === props.hereStep
  return (
    <>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Pressable
        testID={props.testID ?? 'step-picker-field'}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${text}${here ? ', you were here' : ''}`}
        accessibilityHint="Opens the list of steps"
        style={styles.field}
      >
        <Text style={[styles.fieldText, !chosen && value !== null && styles.placeholder]} numberOfLines={1}>{text}</Text>
        {here ? <View style={styles.tag}><Text style={styles.tagText}>You were here</Text></View> : null}
        <Ionicons name="chevron-down" size={20} color={theme.colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <ListSheet
          {...props}
          title={title}
          allowMissing={allowMissing}
          onClose={() => setOpen(false)}
          onPick={(p) => { setOpen(false); onChange(p) }}
        />
      </Modal>
    </>
  )
}

function ListSheet({ steps, value, hereStep, title, allowMissing, onClose, onPick }: StepPickerProps & { title: string; allowMissing: boolean; onClose: () => void; onPick: (p: number | null) => void }) {
  const bottom = useBottomClearance()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // Digits are a step number ("1" finds 1 and 10 to 19); anything else is a word in the title.
  const matches = steps.filter((s) => !q || (/^\d+$/.test(q) ? String(s.position).startsWith(q) : stepTitle(s).toLowerCase().includes(q)))
  const rows: Row[] = [
    ...(allowMissing ? [{ key: 'missing', position: null, title: 'Missing step', sub: 'Or a note on the whole guide' }] : []),
    ...matches.map((s) => ({ key: s.id, position: s.position, title: stepTitle(s) })),
  ]
  // Only a fresh open scrolls to the chosen step: the list remounts per open.
  const start = q ? -1 : rows.findIndex((r) => r.position === value)
  // Every row is mounted (a guide has at most 60 steps), so Missing step and
  // the earlier rows stay reachable to a screen reader; the scroll is a jump.
  const list = useRef<FlatList<Row>>(null)
  useEffect(() => {
    if (start > 0) list.current?.scrollToIndex({ index: start, animated: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
      <Pressable testID="step-list-backdrop" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close step list" style={StyleSheet.absoluteFill} />
      <View style={styles.sheet} testID="step-list-sheet" accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.sheetTitle} accessibilityRole="header">{`${title}?`}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close step list" hitSlop={6}>
            <Ionicons name="close" size={22} color={theme.colors.muted} />
          </Pressable>
        </View>
        <TextField
          search
          icon="search-outline"
          accessibilityLabel="Search steps"
          placeholder="Type a number or a word"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <FlatList
          ref={list}
          testID="step-list"
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={rows.length}
          getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
          contentContainerStyle={{ paddingBottom: bottom }}
          ListFooterComponent={matches.length === 0 ? <Text style={styles.empty}>{`No step matches "${query.trim()}"`}</Text> : null}
          renderItem={({ item }) => {
            const selected = item.position === value
            const isHere = item.position !== null && item.position === hereStep
            const name = item.position === null ? item.title : `${item.position}. ${item.title}`
            return (
              <Pressable
                onPress={() => onPick(item.position)}
                accessibilityRole="button"
                accessibilityLabel={`${name}${isHere ? ', you were here' : ''}`}
                accessibilityState={{ selected }}
                style={[styles.row, selected && styles.rowOn]}
              >
                <View style={styles.badge}><Text style={styles.badgeText}>{item.position ?? '?'}</Text></View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {item.sub ? <Text style={styles.rowSub} numberOfLines={1}>{item.sub}</Text> : null}
                </View>
                {isHere ? <View style={styles.tag}><Text style={styles.tagText}>You were here</Text></View> : null}
                {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primaryDeep} /> : null}
              </Pressable>
            )
          }}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  field: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 52, paddingHorizontal: theme.spacing(4), borderWidth: theme.border.hairline, borderColor: theme.colors.ink, borderRadius: theme.radii.field, backgroundColor: theme.colors.surface },
  fieldText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text },
  placeholder: { color: theme.colors.muted },
  tag: { paddingHorizontal: theme.spacing(2), paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  tagText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.colors.primaryDeep },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: { height: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: theme.spacing(4), gap: theme.spacing(2), ...theme.shadow(3) },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: theme.spacing(2) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), height: ROW_HEIGHT, paddingHorizontal: theme.spacing(2), borderRadius: theme.radii.field },
  rowOn: { backgroundColor: theme.colors.accentFaint },
  badge: { minWidth: 36, height: 36, paddingHorizontal: theme.spacing(1), borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  badgeText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  rowSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  empty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, padding: theme.spacing(4), textAlign: 'center' },
})
