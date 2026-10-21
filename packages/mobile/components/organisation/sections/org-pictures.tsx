// packages/mobile/components/organisation/sections/org-pictures.tsx
// Logo and cover. A picture uploads the moment it is chosen, because the
// upload route writes {slot}_url itself; Remove only clears it locally and the
// profile PATCH sends the null on save.
import { useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../../../lib/theme'
import { pickPreviewedPhoto } from '../../../lib/pick-photo'
import { uploadFile } from '../../../lib/upload'
import { Button } from '../../ui/Button'
import { ListSection } from '../../list/list-kit'

type Slot = 'logo' | 'cover'

export function OrgPictures({
  orgId,
  logo,
  cover,
  onChange,
}: {
  orgId: string
  logo: string | null
  cover: string | null
  onChange: (slot: Slot, url: string | null) => void
}) {
  const [busy, setBusy] = useState<Slot | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(slot: Slot) {
    if (busy) return
    setError(null)
    const result = await pickPreviewedPhoto()
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    setBusy(slot)
    try {
      const { url } = await uploadFile<{ url: string }>(
        '/api/upload/org-image',
        orgId,
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
        'orgId',
        { slot }
      )
      onChange(slot, url)
    } catch (err) {
      setError(/failed with status \d+: (.+)$/.exec(err instanceof Error ? err.message : '')?.[1] ?? 'That did not upload. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const row = (slot: Slot, url: string | null, name: string) => (
    <View style={styles.row}>
      {url ? <Image source={{ uri: url }} accessibilityLabel={`Current ${name}`} style={slot === 'logo' ? styles.logo : styles.cover} /> : null}
      <View style={styles.actions}>
        <Button
          label={url ? `Replace the ${name}` : `Add a ${name}`}
          variant="secondary"
          loading={busy === slot}
          onPress={() => void pick(slot)}
        />
        {url ? <Button label={`Remove the ${name}`} variant="danger" onPress={() => onChange(slot, null)} /> : null}
      </View>
    </View>
  )

  return (
    <>
      <ListSection style={styles.group}>Pictures</ListSection>
      {row('logo', logo, 'logo')}
      {row('cover', cover, 'cover photo')}
      <Text style={styles.hint}>Your workshop, bench or team. No children's faces without written consent.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: theme.spacing(3), marginBottom: 0 },
  row: { gap: theme.spacing(2) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  logo: { width: 96, height: 96, borderRadius: theme.radii.panel, backgroundColor: theme.colors.surfaceSunken },
  cover: { width: '100%', height: 140, borderRadius: theme.radii.panel, backgroundColor: theme.colors.surfaceSunken },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
})
