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

export type ProvenanceOrg = {
  org_id: string
  status: string
  organizations?: { name: string }
}

/**
 * Byline + backing chip for the guide detail screen.
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

  return (
    <View style={styles.wrap}>
      {primary ? (
        <Text style={styles.byline}>
          By{' '}
          <Text onPress={() => onPerson(primary.profile_id)} style={styles.name}>
            {primary.profiles.name}
          </Text>
          {others.length === 1 && (
            <Text>
              {' and '}
              <Text onPress={() => onPerson(others[0].profile_id)} style={styles.name}>
                {others[0].profiles.name}
              </Text>
            </Text>
          )}
          {others.length > 1 && <Text style={styles.count}>{' + '}{others.length}</Text>}
        </Text>
      ) : null}

      {backer ? (
        <Pressable
          onPress={() => onOrg(backer.org_id)}
          accessibilityRole="button"
          style={[styles.chip, { backgroundColor: theme.colors.tone.mint.bg }]}
        >
          <Ionicons name="checkmark" size={14} color={theme.colors.tone.mint.fg} />
          <Text style={[styles.chipText, { color: theme.colors.tone.mint.fg }]}>
            Backed by {backer.organizations?.name ?? 'an organisation'}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.chip, { backgroundColor: theme.colors.tone.sunken.bg }]}>
          <Ionicons name="checkmark" size={14} color={theme.colors.tone.sunken.fg} />
          <Text style={[styles.chipText, { color: theme.colors.tone.sunken.fg }]}>Reviewed by SPLAT</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: theme.spacing(3), gap: theme.spacing(2) },
  byline: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  name: { fontFamily: theme.fonts.bold, color: theme.colors.primaryDeep, textDecorationLine: 'underline' },
  count: { fontFamily: theme.fonts.bold, color: theme.colors.primaryDeep },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  chipText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption },
})
