// packages/mobile/components/ui/PhotoViewer.tsx
//
// A photo full screen: swipe between them, pinch to zoom, ✕ (or the system
// back) to return. A Modal over the screen rather than a route, so closing it
// leaves the reader exactly where they were — the same scroll position, tab
// and build step.
import { useState } from 'react'
import { View, Text, Image, Modal, Pressable, ScrollView, FlatList, StyleSheet, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'

type ViewerPhoto = { uri: string; caption?: string | null }

/** Open with `index` set; null keeps it closed. */
export function PhotoViewer({ photos, index, onClose }: { photos: ViewerPhoto[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [at, setAt] = useState(0)
  const open = index != null && photos.length > 0
  const shown = open ? photos[Math.min(at, photos.length - 1)] : null

  return (
    <Modal
      visible={open}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onShow={() => setAt(index ?? 0)}
      onRequestClose={onClose}
    >
      <View style={styles.page}>
        {open ? (
          <FlatList
            data={photos}
            keyExtractor={(p, i) => `${i}:${p.uri}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: i }) => (
              // iOS zooms a ScrollView natively: pinch, pan while zoomed, and it
              // springs back below 1x.
              // ponytail: Android's ScrollView has no zoom, so there it is full
              // screen without pinch; a gesture-handler pinch if Android needs it.
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={styles.zoom}
                maximumZoomScale={4}
                minimumZoomScale={1}
                centerContent
                bouncesZoom
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{ width, height }}
                  resizeMode="contain"
                  accessibilityLabel={item.caption || `Photo ${i + 1} of ${photos.length}`}
                />
              </ScrollView>
            )}
          />
        ) : null}

        <View style={[styles.top, { paddingTop: insets.top + theme.spacing(2) }]} pointerEvents="box-none">
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={6} style={styles.close}>
            <Ionicons name="close" size={24} color={theme.colors.onColor} />
          </Pressable>
          {photos.length > 1 ? <Text style={styles.count}>{`${Math.min(at, photos.length - 1) + 1} of ${photos.length}`}</Text> : null}
          <View style={styles.spacer} />
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + theme.spacing(4) }]} pointerEvents="none">
          {shown?.caption ? <Text style={styles.caption}>{shown.caption}</Text> : null}
          <Text style={styles.hint}>Pinch to zoom</Text>
        </View>
      </View>
    </Modal>
  )
}

const SCRIM = theme.colors.photoScrim
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.photoGround },
  zoom: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing(4) },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: SCRIM, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 44, height: 44 },
  count: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.onColor, backgroundColor: SCRIM, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(1), overflow: 'hidden' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: theme.spacing(1), paddingHorizontal: theme.spacing(4) },
  caption: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.onColor, textAlign: 'center', backgroundColor: SCRIM, borderRadius: theme.radii.field, paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2), overflow: 'hidden' },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.photoHint },
})
