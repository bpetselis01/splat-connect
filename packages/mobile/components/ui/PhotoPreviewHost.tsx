// packages/mobile/components/ui/PhotoPreviewHost.tsx
import { useEffect, useRef, useState } from 'react'
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { registerPhotoPreviewHost, type PreviewAnswer } from '../../lib/pick-photo'
import { theme } from '../../lib/theme'
import { Button } from './Button'

export function PhotoPreviewHost() {
  const [uris, setUris] = useState<string[] | null>(null)
  const resolve = useRef<((a: PreviewAnswer) => void) | null>(null)

  useEffect(
    () =>
      registerPhotoPreviewHost(
        (u) =>
          new Promise((res) => {
            resolve.current = res
            setUris(u)
          })
      ),
    []
  )

  function answer(a: PreviewAnswer) {
    setUris(null)
    resolve.current?.(a)
    resolve.current = null
  }

  return (
    <Modal visible={uris !== null} animationType="fade" transparent onRequestClose={() => answer('cancel')}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{uris && uris.length > 1 ? 'Use these photos?' : 'Use this photo?'}</Text>
          <ScrollView horizontal={uris !== null && uris.length > 1} contentContainerStyle={styles.photos}>
            {(uris ?? []).map((u) => (
              <Image
                key={u}
                source={{ uri: u }}
                style={uris && uris.length > 1 ? styles.multi : styles.single}
                resizeMode="contain"
                accessibilityLabel="Selected photo preview"
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
          <Button label="Use photo" onPress={() => answer('use')} />
          <Button label="Choose another" variant="secondary" onPress={() => answer('again')} />
          <Button label="Cancel" variant="ghost" onPress={() => answer('cancel')} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: theme.spacing(4), backgroundColor: theme.colors.scrim },
  card: { backgroundColor: theme.colors.background, borderRadius: theme.radii.card, padding: theme.spacing(4), gap: theme.spacing(2) },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  photos: { gap: theme.spacing(2) },
  single: { width: '100%', height: 320, borderRadius: theme.radii.field },
  multi: { width: 220, height: 280, borderRadius: theme.radii.field },
})
