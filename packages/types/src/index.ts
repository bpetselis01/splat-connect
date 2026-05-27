export type Role = 'admin' | 'contributor'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type TutorialStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ContributorRole = 'primary' | 'collaborator'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  approved: boolean
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
