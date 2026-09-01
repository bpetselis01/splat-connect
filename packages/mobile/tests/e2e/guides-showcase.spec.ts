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
  await expect(page.getByText(`Guides by ${author.split(' ')[0]}`)).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()

  await page.getByText(title).click()
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

  await expect(page.getByText(org)).toBeVisible()
  await expect(page.getByText('Guides they back')).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()

  await page.getByText(title).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
})
