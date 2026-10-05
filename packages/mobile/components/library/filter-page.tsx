// packages/mobile/components/library/filter-page.tsx
//
// The libraries' filter page (spec 2026-10-05-library-redesign), EatClub's
// pattern: the filter button opens a full-height page of every filter group,
// with a sticky "Show N" that applies and closes. ✕ drops unapplied choices.
// One component draws the Guides and the Toys page from a list of groups.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CHILD_MEASURES, readMeasure, type ChildMeasureField } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { GroupLabel, OptionPill } from '../ui/FilterControls'

type Option = { readonly value: string; readonly label: string }
export type Measures = Partial<Record<ChildMeasureField, number>>

export type FilterGroup =
  /** One answer, always one chosen (a type, a sort). */
  | { kind: 'one'; key: string; label: string; hint?: string; options: readonly Option[] }
  /** Any number of answers. */
  | { kind: 'many'; key: string; label: string; hint?: string; options: readonly Option[] }
  /** The child's three measurements. */
  | { kind: 'measures'; key: string; label: string; hint?: string }

export type FilterValues = Record<string, string | string[] | Measures>

/** What one chosen filter reads as on a tag under the search, and how removing it changes the values. */
export type FilterTag = { key: string; label: string; remove: (v: FilterValues) => FilterValues }

/** The tags for every filter that differs from its default; the type and sort groups are not tags. */
export function filterTags(groups: FilterGroup[], value: FilterValues, defaults: FilterValues, untagged: string[] = []): FilterTag[] {
  return groups.flatMap((g): FilterTag[] => {
    if (untagged.includes(g.key)) return []
    const v = value[g.key]
    if (g.kind === 'one') {
      if (v === defaults[g.key]) return []
      const o = g.options.find((x) => x.value === v)
      return o ? [{ key: `${g.key}:${o.value}`, label: o.label, remove: (all) => ({ ...all, [g.key]: defaults[g.key] }) }] : []
    }
    if (g.kind === 'many') {
      return ((v as string[]) ?? []).map((x) => ({
        key: `${g.key}:${x}`,
        label: g.options.find((o) => o.value === x)?.label ?? x,
        remove: (all) => ({ ...all, [g.key]: (all[g.key] as string[]).filter((y) => y !== x) }),
      }))
    }
    return Object.entries((v as Measures) ?? {}).map(([field, n]) => {
      const m = CHILD_MEASURES.find((c) => c.field === field)!
      return {
        key: `${g.key}:${field}`,
        label: `${m.label.replace(/ \(.*\)$/, '')} ${n} ${m.label.match(/\((.*)\)/)?.[1] ?? ''}`.trim(),
        remove: (all) => {
          const next = { ...(all[g.key] as Measures) }
          delete next[field as ChildMeasureField]
          return { ...all, [g.key]: next }
        },
      }
    })
  })
}

/** The chosen filters under the search, each a tap to remove. */
export function FilterTagRow({ tags, value, onChange }: { tags: FilterTag[]; value: FilterValues; onChange: (v: FilterValues) => void }) {
  if (!tags.length) return null
  return (
    <View style={styles.tags}>
      {tags.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.remove(value))}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter: ${t.label}`}
          style={styles.tag}
        >
          <Text style={styles.tagText}>{t.label}</Text>
          <Ionicons name="close" size={13} color={theme.colors.primaryDeep} />
        </Pressable>
      ))}
    </View>
  )
}

export function FilterPage({
  visible,
  groups,
  start,
  defaults,
  count,
  noun,
  onApply,
  onClose,
}: {
  visible: boolean
  groups: FilterGroup[]
  /** The values the page opens with: what is applied, or a suggestion on top of it. */
  start: FilterValues
  /** What Reset returns to. */
  defaults: FilterValues
  /** How many results the draft would show, for the button. */
  count: (draft: FilterValues) => number
  /** Singular and plural, for "Show 3 guides". */
  noun: [string, string]
  onApply: (v: FilterValues) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState<FilterValues>(start)
  // The text of each measurement as typed, so a half-typed number is not lost.
  const [typed, setTyped] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!visible) return
    setDraft(start)
    const m = Object.values(start).find((v) => v && typeof v === 'object' && !Array.isArray(v)) as Measures | undefined
    setTyped(Object.fromEntries(Object.entries(m ?? {}).map(([k, n]) => [k, String(n)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const n = count(draft)
  const toggle = (key: string, value: string) => {
    const cur = (draft[key] as string[]) ?? []
    setDraft({ ...draft, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] })
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={18} color={theme.colors.ink} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Filters
          </Text>
          <Pressable
            onPress={() => {
              setDraft(defaults)
              setTyped({})
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <GroupLabel label={g.label} hint={g.hint} />
              {g.kind === 'measures' ? (
                <View style={styles.measures}>
                  {CHILD_MEASURES.map((m) => {
                    const text = typed[m.field] ?? ''
                    const bad = text !== '' && readMeasure(m, text) === undefined
                    return (
                      <View key={m.field} style={styles.measure}>
                        <TextField
                          label={m.label}
                          value={text}
                          placeholder={m.placeholder}
                          keyboardType="number-pad"
                          onChangeText={(t) => {
                            setTyped({ ...typed, [m.field]: t })
                            const v = readMeasure(m, t)
                            const next = { ...((draft[g.key] as Measures) ?? {}) }
                            if (typeof v === 'number') next[m.field] = v
                            else delete next[m.field]
                            setDraft({ ...draft, [g.key]: next })
                          }}
                        />
                        {bad ? <Text style={styles.error}>{`Between ${m.min} and ${m.max}.`}</Text> : null}
                      </View>
                    )
                  })}
                </View>
              ) : (
                <View style={styles.opts} accessibilityRole={g.kind === 'one' ? 'radiogroup' : undefined}>
                  {g.options.map((o) =>
                    g.kind === 'one' ? (
                      <OptionPill key={o.value} radio label={o.label} on={draft[g.key] === o.value} onPress={() => setDraft({ ...draft, [g.key]: o.value })} />
                    ) : (
                      <OptionPill key={o.value} label={o.label} on={((draft[g.key] as string[]) ?? []).includes(o.value)} onPress={() => toggle(g.key, o.value)} />
                    )
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.foot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
          <Button label={`Show ${n} ${n === 1 ? noun[0] : noun[1]}`} onPress={() => onApply(draft)} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  tag: {
    minHeight: 32,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  page: { flex: 1, backgroundColor: theme.colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderBottomWidth: theme.border.hairline,
    borderBottomColor: theme.colors.border,
  },
  close: { width: 36, height: 36, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  reset: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink, textDecorationLine: 'underline' },
  body: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(6) },
  group: { paddingVertical: theme.spacing(4), borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.border, gap: theme.spacing(3) },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  measures: { gap: theme.spacing(1) },
  measure: {},
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger, marginTop: -theme.spacing(2), marginBottom: theme.spacing(2) },
  foot: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(3),
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
})
