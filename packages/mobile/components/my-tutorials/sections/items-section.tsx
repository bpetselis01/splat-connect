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
import { TOOL_GET_BY_LABEL, dollarsToCents, type ToolGetBy } from '@splat-connect/types'
import { useDraft, type ItemRow } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { DateTimeField } from '../../ui/DateTimeField'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'

const NOUN_LABEL = { parts: 'Part', tools: 'Tool' } as const

const LEAD = { parts: 'Everything a family has to buy, with a rough price.', tools: 'What they need on the bench, and what can be borrowed.' }

// The editor mounts once the draft has arrived (see DraftGate).
export function ItemsSection({ noun }: { noun: 'parts' | 'tools' }) {
  return <DraftGate>{() => <ItemsEditor noun={noun} />}</DraftGate>
}

function ItemsEditor({ noun }: { noun: 'parts' | 'tools' }) {
  const { tutorial, replaceItems, save, saveError } = useDraft()
  const withQuantity = noun === 'parts'
  const withNotes = noun === 'tools'
  const singular = NOUN_LABEL[noun]

  const [linksOpen, setLinksOpen] = useState<number | null>(null)
  // What was typed in each price field: '7.' is not yet an amount, so the text
  // is kept per row while price_cents holds the last amount that parsed.
  const [priceText, setPriceText] = useState<Record<number, string>>({})
  // Same for the prices-checked date: a half-typed date must not reach the API.
  const [checkedText, setCheckedText] = useState<string | null>(null)
  const [rows, setRows] = useState<ItemRow[]>(() =>
    ((tutorial?.[noun] ?? []) as ItemRow[]).map((r) => ({
      name: r.name,
      quantity: withQuantity ? (r.quantity ?? 1) : undefined,
      is_optional: r.is_optional,
      buy_links: r.buy_links ?? [],
      ...(withQuantity ? { price_cents: r.price_cents ?? null } : {}),
      ...(withNotes ? { note: r.note ?? null, get_by: r.get_by ?? null } : {}),
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
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={styles.lead}>{LEAD[noun]}</Text>
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
              {noun === 'parts' ? (
                <Button
                  label={`Buy links${row.buy_links.length ? ` (${row.buy_links.length})` : ''}`}
                  accessibilityLabel={`Buy links for part ${i + 1}`}
                  variant="ghost"
                  onPress={() => setLinksOpen((cur) => (cur === i ? null : i))}
                />
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
                onPress={() => {
                  setPriceText({})
                  commit(rows.filter((_, n) => n !== i))
                }}
                style={styles.remove}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
            {withQuantity ? (
              <TextField
                accessibilityLabel={`Part ${i + 1} price`}
                placeholder="$6 — the line at its quantity"
                keyboardType="decimal-pad"
                value={priceText[i] ?? (row.price_cents == null ? '' : (row.price_cents / 100).toFixed(2))}
                onChangeText={(text) => {
                  setPriceText((p) => ({ ...p, [i]: text }))
                  update(i, { price_cents: text.trim() ? (dollarsToCents(text) ?? row.price_cents ?? null) : null })
                }}
              />
            ) : null}
            {noun === 'tools' ? (
              <>
                <TextField
                  accessibilityLabel={`Tool ${i + 1} note`}
                  placeholder="Borrow from a library or makerspace"
                  maxLength={200}
                  value={row.note ?? ''}
                  onChangeText={(text) => update(i, { note: text || null })}
                />
                <View style={styles.controls}>
                  {(Object.keys(TOOL_GET_BY_LABEL) as ToolGetBy[]).map((k) => (
                    <Chip key={k} label={TOOL_GET_BY_LABEL[k]} active={row.get_by === k} onPress={() => update(i, { get_by: row.get_by === k ? null : k })} />
                  ))}
                </View>
              </>
            ) : null}
            {noun === 'parts' && linksOpen === i ? (
              <View style={styles.links}>
                {row.buy_links.map((link, n) => (
                  <View key={n} style={styles.linkRow}>
                    <TextField
                      accessibilityLabel={`Part ${i + 1} link ${n + 1} shop`}
                      placeholder="Shop, e.g. Jaycar"
                      value={link.label}
                      onChangeText={(label) => update(i, { buy_links: row.buy_links.map((l, k) => (k === n ? { ...l, label } : l)) })}
                    />
                    <TextField
                      accessibilityLabel={`Part ${i + 1} link ${n + 1} address`}
                      placeholder="https://"
                      autoCapitalize="none"
                      keyboardType="url"
                      value={link.url}
                      onChangeText={(url) => update(i, { buy_links: row.buy_links.map((l, k) => (k === n ? { ...l, url } : l)) })}
                    />
                    <Button
                      label="Remove link"
                      variant="ghost"
                      onPress={() => update(i, { buy_links: row.buy_links.filter((_, k) => k !== n) })}
                    />
                  </View>
                ))}
                <Button
                  label="+ Add a buy link"
                  variant="ghost"
                  onPress={() => update(i, { buy_links: [...row.buy_links, { label: '', url: '' }] })}
                />
              </View>
            ) : null}
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
          style={styles.add}
          onPress={() =>
            commit([
              ...rows,
              {
                name: '',
                quantity: withQuantity ? 1 : undefined,
                is_optional: false,
                buy_links: [],
                ...(withQuantity ? { price_cents: null } : {}),
                ...(withNotes ? { note: null, get_by: null } : {}),
              },
            ])
          }
        />
        {withQuantity ? (
          <DateTimeField
            label="Prices checked"
            mode="date"
            placeholder="Choose a date"
            value={checkedText ?? tutorial.prices_checked_on ?? ''}
            onChange={(v) => {
              setCheckedText(v)
              if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) save({ prices_checked_on: v || null })
            }}
          />
        ) : null}
        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section={noun} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  // The board opens each section with what it is for.
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },
  // The board's section card: panel radius, one elevation, 14px in.
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.panel,
    padding: 14,
    marginBottom: theme.spacing(3),
    ...theme.shadow(1),
  },
  // The board's dashed full-width "+ Add" under a section's cards.
  add: {
    borderStyle: 'dashed',
    borderWidth: theme.border.hairline * 1.5,
    borderColor: theme.colors.muted,
    borderRadius: theme.radii.pill,
    minHeight: 50,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
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
  links: { marginTop: theme.spacing(3), gap: theme.spacing(2) },
  linkRow: { gap: theme.spacing(1) },
  remove: { marginLeft: 'auto' },
  blankHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
    marginTop: theme.spacing(2),
  },
})
