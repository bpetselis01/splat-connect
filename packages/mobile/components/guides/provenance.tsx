// packages/mobile/components/guides/provenance.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

// Narrower than @splat-connect/types' TutorialContributor/TutorialOrg: this is
// exactly what the public detail embed sends and nothing more, so a fixture
// (or the real payload) satisfies it without carrying fields this component
// never reads.
export type ProvenanceContributor = {
  profile_id: string
  // Loose rather than ContributorRole ('primary' | 'collaborator'): the only
  // comparison here is `=== 'primary'`, and a strict union just makes every
  // fixture that builds a role with a plain string need a cast.
  role: string
  profiles: { name: string }
}

// `organizations` is not optional: the public detail embed selects
// organizations(id, name) through tutorial_orgs.org_id, a NOT NULL FK, so
// PostgREST always returns the object. It is also the only place the org's
// id reaches this screen — the embed does not send org_id, and it does not
// need to when the same uuid is already on the wire here.
export type ProvenanceOrg = {
  status: string
  organizations: { id: string; name: string }
}

/**
 * The contributor card on the guide detail screen: who wrote it, and who
 * stands behind it. The whole card opens the primary contributor; the backing
 * line opens the organisation.
 *
 * "Reviewed by SPLAT" is the fixed, literal copy for the no-backer case —
 * same fixed copy as web's backing-state.tsx and mobile's own library-screen
 * backing(). It is the default path, not an absence: naming it as one would
 * make the default case read as a failure. It is never templated with an
 * org name, even when the tutorial went through a specific org's leader
 * queue — that queue is not the same claim as an org backing the project.
 */
export function Provenance({
  contributors,
  orgs,
  onPerson,
  onOrg,
}: {
  contributors: ProvenanceContributor[]
  orgs: ProvenanceOrg[]
  onPerson: (profileId: string) => void
  onOrg: (orgId: string) => void
}) {
  const primary = contributors.find((c) => c.role === 'primary') ?? contributors[0]
  const others = contributors.filter((c) => c !== primary)
  // Already filtered to accepted-only by the public route; filtered again here
  // for the same belt-and-braces reason library-screen's backing() does it.
  const backer = orgs.find((o) => o.status === 'accepted')
  if (!primary) return null
  const initials = primary.profiles.name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Pressable
      onPress={() => onPerson(primary.profile_id)}
      accessibilityRole="button"
      accessibilityHint="Opens their profile"
      style={styles.card}
    >
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          <Text>{primary.profiles.name}</Text>
          {others.length === 1 && (
            <Text>
              {' and '}
              <Text onPress={() => onPerson(others[0].profile_id)} accessibilityRole="link">
                {others[0].profiles.name}
              </Text>
            </Text>
          )}
          {others.length > 1 && <Text style={styles.count}>{' + '}{others.length}</Text>}
        </Text>
        {backer ? (
          <Text
            onPress={() => onOrg(backer.organizations.id)}
            accessibilityRole="link"
            style={[styles.backing, styles.backingLink]}
          >
            Backed by {backer.organizations.name}
          </Text>
        ) : (
          <Text style={styles.backing}>Reviewed by SPLAT</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(1),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  count: { color: theme.colors.primaryDeep },
  backing: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  backingLink: { color: theme.colors.primaryDeep },
})
