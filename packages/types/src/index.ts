export type Role = 'admin' | 'contributor' | 'parent'

export interface ChildProfile {
  id: string
  parent_id: string
  age: number | null
  // Ability Profile
  primary_diagnosis: string | null
  macs_level: string | null
  macs_source: 'manual' | 'estimated'
  hand_involvement: 'bilateral' | 'unilateral' | null
  assist_hand: 'left' | 'right' | null
  bfmf_score: string | null
  bfmf_source: 'manual' | 'estimated'
  // Everyday Needs
  challenges: string[]
  challenge_other: string | null
  grip_type: string | null
  env_context: string | null
  // Customization Metrics
  palm_width_mm: number | null
  wrist_circ_mm: number | null
  needs_arm_attachment: boolean
  forearm_length_mm: number | null
  hand_dominance: string | null
  sensory_preferences: string[]
  updated_at: string
}
export type Difficulty = 'easy' | 'medium' | 'hard'
export type TutorialStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ContributorRole = 'primary' | 'collaborator'

export type OrgStatus = 'pending' | 'approved' | 'suspended'
export type OrgTrustLevel = 'probation' | 'trusted'
export type OrgRole = 'leader' | 'member'
export type OrgMemberStatus = 'pending' | 'approved' | 'removed' | 'declined'
export type InitiatedBy = 'contributor' | 'org'
export type ReviewLevel = 'org' | 'platform'
export type AgreementType = 'contributor_terms' | 'org_leader_terms'

// The version string recorded against an acceptance. 'v0-todo' is deliberately
// non-binding: the real terms have not been written (they need a lawyer — see
// the spec's §6). Any acceptance recorded at this version is void and its rows
// should be discarded when real terms land.
export const AGREEMENT_VERSIONS: Record<AgreementType, string> = {
  contributor_terms: 'v0-todo',
  org_leader_terms: 'v0-todo',
}

export interface Organization {
  id: string
  name: string
  description: string | null
  status: OrgStatus
  trust_level: OrgTrustLevel
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  org_role: OrgRole
  status: OrgMemberStatus
  initiated_by: InitiatedBy
  invited_by: string | null
  created_at: string
  joined_at: string | null
  // Populated when the query joins profiles (roster and queue views).
  profiles?: Profile
  organizations?: Organization
}

export interface UserAgreement {
  id: string
  user_id: string
  agreement_type: AgreementType
  version: string
  accepted_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
}

export interface Tutorial {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  status: TutorialStatus
  tutorial_pdf_url: string | null
  toy_photo_url: string | null
  rejection_note: string | null
  created_at: string
  reviewed_at: string | null
  // Snapshot of the org at submit time; null routes to the platform queue.
  org_id: string | null
  review_level: ReviewLevel | null
  reviewed_by: string | null
  flagged_for_follow_up: boolean
}

// Links a tutorial to a person. The profiles field is optional here
// but will be required when used inside TutorialWithDetails
export interface TutorialContributor {
  tutorial_id: string
  profile_id: string
  role: ContributorRole
  added_at: string
  // Optional: the actual person's profile info (name, email, etc.)
  profiles?: Profile
}

export interface BuyLink {
  label: string
  url: string
}

export interface Part {
  id: string
  tutorial_id: string
  name: string
  quantity: number
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface Tool {
  id: string
  tutorial_id: string
  name: string
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface StlFile {
  id: string
  tutorial_id: string
  filename: string
  file_url: string
}

// A tutorial with all its related information: the parts needed, tools needed,
// 3D files, and the people who created it.
// Note: tutorial_contributors REQUIRES the profiles field (makes it non-optional)
// so you always have the contributor's full info when viewing a complete tutorial
export interface TutorialWithDetails extends Tutorial {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: (TutorialContributor & { profiles: Profile })[]
}

// A draft tutorial being filled out by a contributor on the upload form.
// This is temporary state before submission — it allows empty values and null files.
// When submitted, the API converts this into actual Tutorial, Part, Tool, and StlFile
// records in the database.
export interface UploadDraft {
  title: string
  description: string
  difficulty: Difficulty | ''
  tutorial_pdf_url: string | null
  toy_photo_url: string | null
  parts: { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }[]
  tools: { name: string; is_optional: boolean; buy_links: BuyLink[] }[]
  stl_files: { filename: string; file_url: string }[]
}
