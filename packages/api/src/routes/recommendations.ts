import { subResourceRoutes } from './sub-resource.js'

// Up to three tutorials a creator points readers at. Replace-all on POST like
// the other sub-resources; position is the order they were sent in, and 048's
// constraints — position 1..3, unique per tutorial, no self-reference — are
// what reject a fourth. The editor never offers a fourth slot, so that is a
// backstop rather than a path. `required` (129) is "Required first".
type RecommendationInput = { recommended_id: string; required?: boolean }

export default subResourceRoutes<RecommendationInput>({
  path: 'recommendations',
  table: 'tutorial_recommendations',
  bodyKey: 'recommendations',
  keepsApproval: true,
  mapRow: (r, tutorialId, index) => ({
    tutorial_id: tutorialId,
    recommended_id: r.recommended_id,
    position: index + 1,
    required: r.required === true,
  }),
})
