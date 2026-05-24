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

export interface TutorialContributor {
  tutorial_id: string
  profile_id: string
  role: ContributorRole
  added_at: string
  profiles?: Profile
}

export interface Part {
  id: string
  tutorial_id: string
  name: string
  quantity: number
  buy_link: string | null
}

export interface Tool {
  id: string
  tutorial_id: string
  name: string
  buy_link: string | null
}

export interface StlFile {
  id: string
  tutorial_id: string
  filename: string
  file_url: string
}

export interface TutorialWithDetails extends Tutorial {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: (TutorialContributor & { profiles: Profile })[]
}

// Upload form state (client-side only, not persisted until submit)
export interface UploadDraft {
  title: string
  description: string
  difficulty: Difficulty | ''
  tutorial_pdf_url: string | null
  toy_photo_url: string | null
  parts: { name: string; quantity: number; buy_link: string | null }[]
  tools: { name: string; buy_link: string | null }[]
  stl_files: { filename: string; file_url: string }[]
}
