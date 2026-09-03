// packages/mobile/components/my-tutorials/sections/items-section.tsx
//
// Parts and tools: one replace-set list, two nouns. Only parts carry a
// quantity, so only parts draw the stepper.
//
// Rows are local state seeded once from the tutorial, because a row being typed
// has no id yet and the server's copy would overwrite it mid-keystroke. Every
// mutation calls replaceItems, which debounces the POST — there is no Save
// button, and leaving the screen no longer discards the list, which is what it
// did before: the rows lived here until a button nobody had pressed sent them.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useDraft, type ItemRow } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../auth-screen'
import { SectionFooter } from '../section-footer'

const NOUN_LABEL = { parts: 'Part', tools: 'Tool' } as const

export function ItemsSection({ noun }: { noun: 'parts' | 'tools' }) {
  const { tutorial, replaceItems, saveError } = useDraft()
  const withQuantity = noun === 'parts'
  const singular = NOUN_LABEL[noun]

  const [rows, setRows] = useState<ItemRow[]>(() =>
    ((tutorial?.[noun] ?? []) as ItemRow[]).map((r) => ({
      name: r.name,
      quantity: withQuantity ? (r.quantity ?? 1) : undefined,
      is_optional: r.is_optional,
      buy_links: r.buy_links ?? [],
    }))
  )

  if (!tutorial) return null

  function commit(next: ItemRow[]) {
    setRows(next)
    replaceItems(noun, next)
  }

  const update = (i: number, patch: Partial<ItemRow>) =>
    commit(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        {rows.length === 0 ? <Text style={styles.empty}>No {noun} yet.</Text> : null}

        {rows.map((row, i) => (
          <View key={i} testID={`item-row-${i}`} style={styles.card}>
            <TextField
              accessibilityLabel={`${singular} ${i + 1} name`}
              placeholder={`${singular} name`}
              value={row.name}
              onChangeText={(text) => update(i, { name: text })}
            />
            <View style={styles.controls}>
              {withQuantity ? (
                <View style={styles.stepper}>
                  <Pressable
                    testID={`item-qty-down-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease quantity for part ${i + 1}`}
                    onPress={() => update(i, { quantity: Math.max(1, (row.quantity ?? 1) - 1) })}
                    style={styles.stepperButton}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>-</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{row.quantity ?? 1}</Text>
                  <Pressable
                    testID={`item-qty-up-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase quantity for part ${i + 1}`}
                    onPress={() => update(i, { quantity: (row.quantity ?? 1) + 1 })}
                    style={styles.stepperButton}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>+</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                testID={`item-optional-${i}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.is_optional }}
                accessibilityLabel={`${singular} ${i + 1} optional`}
                onPress={() => update(i, { is_optional: !row.is_optional })}
                style={styles.optional}
              >
                <Ionicons
                  name={row.is_optional ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.optionalLabel}>Optional</Text>
              </Pressable>
              <Pressable
                testID={`item-remove-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${singular.toLowerCase()} ${i + 1}`}
                onPress={() => commit(rows.filter((_, n) => n !== i))}
                style={styles.remove}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
            {/* Named rather than silently dropped: replaceItems filters blank
                names out of the POST, so without this the row looks saved. */}
            {!row.name.trim() ? (
              <Text style={styles.blankHint}>Add a name to save this row</Text>
            ) : null}
          </View>
        ))}

        <Button
          testID="items-add"
          label={`+ Add a ${singular.toLowerCase()}`}
          variant="ghost"
          onPress={() =>
            commit([
              ...rows,
              {
                name: '',
                quantity: withQuantity ? 1 : undefined,
                is_optional: false,
                buy_links: [],
              },
            ])
          }
        />
        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section={noun} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    ...theme.shadow(3),
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
  },
  stepperGlyph: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.body,
    color: theme.colors.ink,
  },
  quantity: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.body,
    color: theme.colors.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  optional: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  optionalLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  remove: { marginLeft: 'auto' },
  blankHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.apricotDeep,
    marginTop: theme.spacing(2),
  },
})
