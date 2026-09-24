// packages/mobile/components/printing/add-printer-screen.tsx
/**
 * Add a printer — four questions, and no free-text address.
 *
 * Material and bed size are what requests are matched on, so they get the
 * most room. The bed is one of four sizes rather than three millimetre fields:
 * a family's part fits a cube, and nobody measures their bed's Z to add a
 * printer.
 *
 * Where the printer is comes from the profile's pickup suburb and state; the
 * street address is copied onto a job only when it is accepted. How it is
 * handed over has no column on `printers`, so the choice is written into the
 * printer's notes, which is where the directory and the family read it.
 */
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../auth-screen'
import { apiMessage } from '@splat-connect/types'

// The board's four. PRINT_MATERIALS has six; ASA and Nylon are rare enough on
// a home machine that offering them here would crowd the two that matter.
const MATERIALS = ['PETG', 'PLA', 'TPU', 'ABS']

const BEDS: Array<[number, string, string]> = [
  [180, 'Small', 'up to 180 mm'],
  [220, 'Standard', '220 mm · most printers'],
  [256, 'Large', '256 mm'],
  [300, 'Extra large', '300 mm+'],
]

const PICKUPS: Array<[string, string, React.ComponentProps<typeof Ionicons>['name']]> = [
  ['Porch pickup', 'They collect from your door, by arrangement', 'home-outline'],
  ['Meet somewhere public', 'A library or café you pick', 'map-outline'],
  ['Post it', 'You post it and the family covers the satchel', 'mail-outline'],
]

function Option({
  title,
  sub,
  on,
  onPress,
  icon,
  style,
}: {
  title: string
  sub: string
  on: boolean
  onPress: () => void
  icon?: React.ComponentProps<typeof Ionicons>['name']
  style?: object
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={[styles.option, on && styles.optionOn, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={theme.colors.primaryDark} /> : null}
      <View style={styles.flex}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.meta}>{sub}</Text>
      </View>
    </Pressable>
  )
}

export function AddPrinterScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [name, setName] = useState('')
  const [materials, setMaterials] = useState<string[]>(['PETG'])
  const [bed, setBed] = useState(220)
  const [pickup, setPickup] = useState(0)
  const [ownerOrgId, setOwnerOrgId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ledOrgs = caps?.ledOrgs ?? []
  const valid = name.trim().length > 0 && materials.length > 0

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/api/printers', {
        name: name.trim(),
        materials,
        bed_x: bed,
        bed_y: bed,
        bed_z: bed,
        suburb: caps?.profile.pickup_suburb ?? '',
        state: caps?.profile.pickup_state ?? '',
        notes: `${PICKUPS[pickup]![0]} — ${PICKUPS[pickup]![1]}`,
        ...(ownerOrgId ? { owner_org_id: ownerOrgId } : {}),
      })
      router.back()
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Check your connection and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.lede}>
          Four things. Requests are matched on material and bed size, so those two matter most.
        </Text>

        {ledOrgs.length ? (
          <View style={styles.group}>
            <Text style={styles.eyebrow}>Whose machine</Text>
            <View accessibilityRole="radiogroup" style={styles.row}>
              <Chip label="Mine" role="radio" active={ownerOrgId === null} onPress={() => setOwnerOrgId(null)} />
              {ledOrgs.map((o) => (
                <Chip key={o.id} label={o.name} role="radio" active={ownerOrgId === o.id} onPress={() => setOwnerOrgId(o.id)} />
              ))}
            </View>
          </View>
        ) : null}

        <TextField
          label="Make and model"
          accessibilityLabel="Make and model"
          placeholder="e.g. Bambu P1S"
          maxLength={80}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.group}>
          <Text style={styles.eyebrow}>Materials you keep loaded</Text>
          <View style={styles.row}>
            {MATERIALS.map((m) => (
              <Chip
                key={m}
                label={m}
                active={materials.includes(m)}
                onPress={() => setMaterials((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
              />
            ))}
          </View>
          <Text style={styles.meta}>
            Most guides ask for PETG. PLA is fine for anything that does not get chewed or clamped.
          </Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.eyebrow}>Bed size</Text>
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {BEDS.map(([mm, title, sub]) => (
              <Option key={mm} title={title} sub={sub} on={bed === mm} onPress={() => setBed(mm)} style={styles.half} />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.eyebrow}>Pickup</Text>
          <View accessibilityRole="radiogroup" style={styles.group}>
            {PICKUPS.map(([title, sub, icon], i) => (
              <Option key={title} title={title} sub={sub} icon={icon} on={pickup === i} onPress={() => setPickup(i)} />
            ))}
          </View>
          <Text style={styles.meta}>
            Your street address is never shown. Requesters see a suburb until you accept, then whatever pickup you
            chose.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ErrorRow message={error} />
        <Button label="Add printer" disabled={!valid} loading={busy} onPress={save} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(4) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  group: { gap: theme.spacing(2) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  half: { flexBasis: '48%', flexGrow: 1 },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    minHeight: 56,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentLight },
  optionTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing(3),
  },
})
