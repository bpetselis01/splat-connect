import { test, expect } from '@playwright/test'
import { signInAsNewContributor, createTutorial, uniqueTitle, adminClient } from './helpers'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Detail')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/guides')
  await page.getByText(title).click()

  // .last() throughout: the library screen stays mounted behind the detail
  // screen, so the title, description and badge each match twice.
  await expect(page.getByText(title).last()).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.').last()).toBeVisible()
  // EASY, not "Easy": components/ui/Badge.tsx uppercases the word in the
  // string (matching web's badge.tsx), where the DifficultyBadge this screen
  // used to render left it title-case and uppercased it in CSS. The only
  // "Easy" left on the page is the difficulty filter chip on the library
  // screen behind, which is hidden — so the old assertion could not pass.
  await expect(page.getByText('EASY', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('E2E part × 2')).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Preview')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})

test('an aborted detail request shows the retry message', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Detail Error'),
    status: 'approved',
  })

  // Signed in before the route is armed: the sign-in landing fetches the
  // library, and aborting that too would confuse this spec's subject.
  await page.route(`**/api/public/tutorials/${id}`, (route) => route.abort())
  await page.goto(`/guides/${id}`)

  await expect(page.getByText("Couldn't load tutorial. Please try again.")).toBeVisible()
})

test('an unknown tutorial id shows the load-failure state', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/guides/00000000-0000-0000-0000-000000000000')

  // The API answers an unknown id with a 404, which apiClient raises, so the
  // screen takes its `error` branch. The `!tutorial` branch ("Tutorial not
  // found.") is therefore unreachable through this path — see the spec's
  // negative space.
  await expect(page.getByText("Couldn't load tutorial. Please try again.")).toBeVisible()
})

test('optional parts and tools are badged on the detail screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Optional')
  await createTutorial(contributor.id, { title, status: 'approved', withOptionalExtras: true })

  await page.goto('/guides')
  await page.getByText(title).click()

  // Mobile marks optional items inline in the row label — there is no separate
  // badge here, unlike the web detail page.
  await expect(page.getByText('E2E optional part × 1 (optional)')).toBeVisible()
  await expect(page.getByText('E2E optional tool (optional)')).toBeVisible()
  await expect(page.getByText('E2E part × 2', { exact: true })).toBeVisible()
})

test('the preview screen explains when a tutorial has no PDF', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile No PDF')
  await createTutorial(contributor.id, { title, status: 'approved', withPdf: false })

  await page.goto('/guides')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('No PDF is available for this tutorial yet.')).toBeVisible()
  await expect(page.getByText('Open in Browser')).toHaveCount(0)
})

test('the byline names the primary contributor and opens their showcase', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const author = uniqueTitle('E2E Author')
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Byline'),
    status: 'approved',
    contributorName: author,
  })

  await page.goto(`/guides/${id}`)
  await expect(page.getByText(author)).toBeVisible()
  await page.getByText(author).click()

  await expect(page).toHaveURL(new RegExp(`/guides/contributor/${contributor.id}$`))
})

test("a backed guide's chip opens the organisation's showcase", async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Detail Backed')
  const org = uniqueTitle('E2E Detail Org')
  const id = await createTutorial(contributor.id, { title, status: 'approved', backedByOrg: org })

  await page.goto(`/guides/${id}`)
  await page.getByText(`Backed by ${org}`).click()

  await expect(page).toHaveURL(/\/guides\/organisation\/[0-9a-f-]{36}$/)
})

test('an unbacked guide shows the fixed Reviewed by SPLAT chip instead', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Unbacked'),
    status: 'approved',
  })

  await page.goto(`/guides/${id}`)

  await expect(page.getByText('Reviewed by SPLAT')).toBeVisible()
})

test('an assistive-tech guide shows the 3D-print placeholder', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Printable'),
    status: 'approved',
    kind: 'assistive_tech',
  })

  await page.goto(`/guides/${id}`)

  await expect(page.getByText('Request this 3D print')).toBeVisible()
  // Badge uppercases the string itself, so the text node reads SOON.
  await expect(page.getByText('SOON')).toBeVisible()
})

test('a toy adaptation has no 3D-print placeholder', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Not Printable'),
    status: 'approved',
  })

  await page.goto(`/guides/${id}`)

  await expect(page.getByText('Parts')).toBeVisible()
  await expect(page.getByText('Request this 3D print')).toHaveCount(0)
})

test("the creator's picks row lists a recommendation and opens it", async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const pickTitle = uniqueTitle('E2E Mobile Pick')
  const pickId = await createTutorial(contributor.id, { title: pickTitle, status: 'approved' })
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Picker'),
    status: 'approved',
    contributorName: uniqueTitle('E2E Author'),
  })
  // Seeded through the service role rather than the web recommendations UI:
  // this spec is about the row rendering, not about how a pick gets made.
  const { error } = await adminClient()
    .from('tutorial_recommendations')
    .insert({ tutorial_id: id, recommended_id: pickId, position: 1 })
  if (error) throw new Error(`Failed to seed recommendation: ${error.message}`)

  await page.goto(`/guides/${id}`)

  await expect(page.getByText(/ALSO WORTH A LOOK/)).toBeVisible()
  await page.getByText(pickTitle).click()

  await expect(page).toHaveURL(new RegExp(`/guides/${pickId}$`))
})
