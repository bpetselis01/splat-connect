// packages/mobile/components/ui/MessageBubble.tsx
// One row of a thread. Lifted verbatim out of exchanges/thread-screen.tsx
// when the challenge thread became its second caller — @splat-connect/types
// already declares `ThreadMessage` as "the structural minimum … Both
// ToyTransactionMessage and ToyIdeaMessage satisfy it", so the seam was named
// before either screen needed it.
import { View, Text, StyleSheet } from 'react-native'
import type { ThreadMessage } from '@splat-connect/types'
import { theme } from '../../lib/theme'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

export function MessageBubble({
  message,
  mine,
  senderName,
}: {
  message: ThreadMessage
  mine: boolean
  senderName: string
}) {
  if (message.kind === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    )
  }
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View
        // Left/right and the tint are the only things separating your messages
        // from theirs on screen, and neither reaches a screen reader.
        accessible
        accessibilityLabel={`${mine ? 'You' : senderName} said: ${message.body}`}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
      >
        {!mine ? <Text style={styles.bubbleWho}>{senderName}</Text> : null}
        <Text style={styles.bubbleText}>{message.body}</Text>
        <Text style={styles.stamp}>{timeOf(message.created_at)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  systemRow: { alignItems: 'center', paddingVertical: theme.spacing(1) },
  systemText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    borderWidth: theme.border.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    gap: theme.spacing(1),
  },
  bubbleMine: { backgroundColor: theme.colors.accentLight },
  bubbleTheirs: { backgroundColor: theme.colors.surface },
  bubbleWho: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  bubbleText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  stamp: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted, alignSelf: 'flex-end' },
})
