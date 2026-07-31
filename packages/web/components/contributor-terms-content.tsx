/**
 * The actual (placeholder) contributor-terms text. One copy, three places it
 * renders: the standalone /legal/contributor-terms page, the signup dialog
 * (components/contributor-terms-dialog.tsx), and the onboarding catch-up gate
 * (app/onboarding/contributor-terms/page.tsx) — the latter two via
 * TermsGate's `content` prop.
 *
 * CONTENT PENDING — see app/legal/contributor-terms/page.tsx for the
 * constraints on what belongs here once real terms are written. No
 * placeholder legal language is to be generated here.
 */
export function ContributorTermsContent() {
  return (
    <p className="alert alert-warning">
      These terms have not been written yet. Anything you accept here is not
      binding, and will be replaced.
    </p>
  )
}
