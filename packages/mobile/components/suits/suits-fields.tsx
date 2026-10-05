// packages/mobile/components/suits/suits-fields.tsx
//
// "Who it's for" (128): the four child questions, answered by whoever made a
// guide or toy, plus Device type on a guide. The same answers a child's
// profile gives, so families find it with the filters and under Recommended.
// One form for both editors; none of it is required.
import { View, Text, StyleSheet } from 'react-native'
import { CHILD_QUESTIONS, DEVICE_TYPES, ONE_HAND_LABEL, type Suits } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { ManyChips } from '../profile/fields'

/** The form: every list as a list (never null), one_hand as a flag. */
export type SuitsForm = { [K in Exclude<keyof Suits, 'one_hand'>]-?: NonNullable<Suits[K]> } & { one_hand: boolean }

export function suitsForm(row: Suits): SuitsForm {
  return {
    device_types: row.device_types ?? [],
    helps_with: row.helps_with ?? [],
    access: row.access ?? [],
    one_hand: row.one_hand === true,
    press_force: row.press_force ?? [],
    play: row.play ?? [],
  }
}

/** The columns to send: an emptied list is null. A toy's editor leaves device_types out. */
export function suitsPayload(form: SuitsForm, guide: boolean): Suits {
  const list = <T,>(v: T[]) => (v.length ? v : null)
  return {
    ...(guide ? { device_types: list(form.device_types) } : {}),
    helps_with: list(form.helps_with),
    access: list(form.access),
    one_hand: form.one_hand,
    press_force: list(form.press_force),
    play: list(form.play),
  }
}

const ITEM_LABEL: Record<(typeof CHILD_QUESTIONS)[number]['item'], string> = {
  helps_with: 'Helps with',
  access: 'How a child uses it',
  press_force: 'Press force it works with',
  play: 'Play',
}

export function SuitsFields({ value, onChange, guide }: { value: SuitsForm; onChange: (next: SuitsForm) => void; guide: boolean }) {
  return (
    <View>
      <Text style={styles.help}>
        None of this is required, but untagged {guide ? 'guides' : 'toys'} never show up in filters or as recommended.
      </Text>
      {guide ? (
        <>
          <Text style={styles.label}>What is it?</Text>
          <ManyChips options={DEVICE_TYPES} value={value.device_types} onChange={(device_types) => onChange({ ...value, device_types })} />
        </>
      ) : null}
      {CHILD_QUESTIONS.map((q) => (
        <View key={q.item}>
          <Text style={styles.label}>{ITEM_LABEL[q.item]}</Text>
          <ManyChips
            options={q.options as readonly { value: string; label: string }[]}
            value={value[q.item] as string[]}
            onChange={(next) => onChange({ ...value, [q.item]: next })}
          />
          {q.item === 'access' ? (
            <ManyChips
              options={[{ value: 'one_hand', label: ONE_HAND_LABEL }]}
              value={value.one_hand ? ['one_hand'] : []}
              onChange={(next) => onChange({ ...value, one_hand: next.length > 0 })}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  help: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
})
