/**
 * Contributor Terms — CONTENT PENDING
 *
 * TODO: real terms, written by a lawyer. Must cover jurisdiction-specific
 * liability and TGA / medical-device considerations for assistive equipment used
 * by disabled children.
 *
 * Two disclosures belong here specifically (spec §6):
 *  1. Offering a project to an organisation lets that organisation's leaders read
 *     the unpublished draft, including if they then decline it.
 *  2. An organisation's leader may approve their own work.
 *
 * Acceptances recorded against version 'v0-todo' are void and should be discarded
 * when real terms land. No placeholder legal language is to be generated here.
 */
import { ContributorTermsContent } from '@/components/contributor-terms-content'

export default function ContributorTermsPage() {
  return (
    <main className="container">
      <h1>Contributor terms</h1>
      <ContributorTermsContent />
    </main>
  )
}
