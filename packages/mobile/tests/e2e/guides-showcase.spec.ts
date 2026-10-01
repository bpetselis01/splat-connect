import { test, expect } from '@playwright/test'
import { signInAsNewContributor, createTutorial, uniqueTitle, adminClient } from './helpers'

test("the contributor page lists that contributor's guides and opens one", async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const author = uniqueTitle('E2E Showcase Author')
  const title = uniqueTitle('E2E Showcase Guide')
  const id = await createTutorial(contributor.id, {
    title,
    status: 'approved',
    contributorName: author,
  })

  // Straight to the URL rather than through the guide's byline — that hop is
  // the detail spec's subject; this one is about the page it lands on.
  await page.goto(`/guides/contributor/${contributor.id}`)

  await expect(page.getByText(author)).toBeVisible()
  await expect(page.getByText('Published guides')).toBeVisible()
  await expect(page.getByRole('button', { name: title })).toBeVisible()

  await page.getByRole('button', { name: title }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
})

test('the organisation page lists the guides it backs', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Showcase Backed')
  const org = uniqueTitle('E2E Showcase Org')
  const id = await createTutorial(contributor.id, { title, status: 'approved', backedByOrg: org })

  // createTutorial mints the organisation but hands back only the tutorial id
  // (its callers all destructure a bare string), so the id is read back here.
  const { data, error } = await adminClient()
    .from('organizations')
    .select('id')
    .eq('name', org)
    .single()
  if (error || !data) throw new Error(`Failed to read back organisation: ${error?.message}`)

  await page.goto(`/guides/organisation/${data.id}`)

  // A heading: the page also has "Say thanks to <org>" (077).
  await expect(page.getByRole('heading', { name: org })).toBeVisible()
  await expect(page.getByText('Guides they back')).toBeVisible()
  // The list stays mounted (hidden) under a deep-linked screen, so the title
  // matches twice on web: the visible one is the one on this screen.
  await expect(page.getByText(title).filter({ visible: true })).toBeVisible()

  await page.getByText(title).filter({ visible: true }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
})
