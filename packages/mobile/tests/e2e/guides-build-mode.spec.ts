// journeys: B01 B02 B03 B06 G15
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

// Build mode from Get ready to the logged build: the All steps sheet, Start
// over, a builder's pinned note on its step, and the tutorial_builds row.
// guides-reader-journeys.spec.ts covers resuming and the completion screen.

const STEPS = [
  { title: 'Open the bay', body: 'Undo one screw.' },
  { title: 'Slide it in', body: 'Copper side down.' },
  { title: 'Close it', body: 'Click.' },
]

test('Start building opens on Get ready with the parts, tools and safety checks, and Start step 1 begins', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Build Get Ready')
  const id = await createTutorial(author.id, { title })
  await addSteps(id, STEPS)

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await expect(page.getByText('3 steps', { exact: true })).toBeVisible()
  await expect(page.getByText('0/1 parts · 0/1 tools')).toBeVisible()
  // The guide page, still mounted underneath, has the same checklist: build mode's is the last.
  await expect(page.getByText('6 safety checks passed').last()).toBeVisible()
  await expect(page.getByText('No mains voltage anywhere in the design')).toHaveCount(0)
  await page.getByRole('button', { name: /safety checks passed/ }).last().click()
  await expect(page.getByText('No mains voltage anywhere in the design')).toBeVisible()
  await expect(page.getByText('Screen stays on')).toBeVisible()

  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await expect(page.getByText('Open the bay', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Undo one screw.')).toBeVisible()
})

test('the All steps sheet jumps to a step, and Start over clears the ticks back to Get ready', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build All Steps') })
  await addSteps(id, STEPS)

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 2 of 3')).toBeVisible()

  // The guide page stays mounted under build mode, so its step rows share these names: the sheet's are last.
  await page.getByRole('button', { name: 'All steps', exact: true }).click()
  await expect(page.getByText('1 of 3 done')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Step 1: Open the bay, done' }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Step 3: Close it', exact: true }).last().click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('Click.', { exact: true })).toBeVisible()
  await expect(page.getByText('All steps', { exact: true })).toHaveCount(0)

  // Jumping ahead ticks nothing: step 1 is the only one done.
  await page.getByRole('button', { name: 'All steps', exact: true }).click()
  await expect(page.getByText('1 of 3 done')).toBeVisible()
  await page.getByRole('button', { name: 'Start over and clear ticks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()

  // Back on the guide, nothing is ticked and it starts from the top again.
  await page.getByRole('button', { name: 'Close build mode' }).click()
  await expect(page.getByRole('button', { name: 'Start building', exact: true })).toBeVisible()
  await expect(page.getByText('0/3', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Start building', exact: true })).toBeVisible()
})

test('a pinned note shows on its own step only, with who approved it, and the unpinned ones point to Notes', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const builder = await createContributor()
  await renameProfile(builder.id, 'Dan Builder')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Pinned Note') })
  await addSteps(id, STEPS)
  const pinned = `Use a longer screw 🧸 "here" <b>& there</b> ${Date.now()}`
  await addNote(id, builder.id, { step_position: 2, body: pinned, pinnedBy: author.id })
  await addNote(id, builder.id, { step_position: 2, body: 'An unpinned thought.' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await expect(page.getByText('Notes from builders')).toHaveCount(0)

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await expect(page.getByText('Notes from builders')).toBeVisible()
  await expect(page.getByText(pinned, { exact: true })).toBeVisible()
  await expect(page.getByText('Approved by Mei')).toBeVisible()
  await expect(page.getByText('Dan Builder', { exact: true })).toBeVisible()
  // The unpinned one stays in the guide's Notes, and the link says how many.
  await expect(page.getByText('An unpinned thought.')).toHaveCount(0)
  await expect(page.getByText("1 more note in the guide's Feedback")).toBeVisible()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('Notes from builders')).toHaveCount(0)
  await expect(page.getByText(pinned, { exact: true })).toHaveCount(0)
})

test('finishing the last step and tapping Add to My SPLAT logs the build', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Logged') })
  await addSteps(id, STEPS)

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('You built it!')).toBeVisible()
  await expect(page.getByText('All 3 steps done')).toBeVisible()

  // Nothing is logged by finishing alone.
  const before = await adminClient().from('tutorial_builds').select('profile_id').eq('tutorial_id', id)
  expect(before.data).toEqual([])

  const posted = page.waitForResponse((r) => r.url().endsWith(`/api/tutorials/${id}/build`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Add to My SPLAT', exact: true }).click()
  expect((await posted).status()).toBeLessThan(300)
  await expect(page.getByText('Build logged — nice work')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Added to My SPLAT', exact: true })).toBeDisabled()

  const { data } = await adminClient().from('tutorial_builds').select('profile_id').eq('tutorial_id', id)
  expect(data).toEqual([{ profile_id: reader.id }])
})

test('a build that fails to log says so and can be tried again', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Log Fails') })
  await addSteps(id, [{ body: 'Only step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  await page.route(`**/api/tutorials/${id}/build`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }))
  await page.getByRole('button', { name: 'Add to My SPLAT', exact: true }).click()
  await expect(page.getByText('Could not log that. Try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to My SPLAT', exact: true })).toBeEnabled()
  const { data } = await adminClient().from('tutorial_builds').select('profile_id').eq('tutorial_id', id).eq('profile_id', reader.id)
  expect(data).toEqual([])

  await page.unroute(`**/api/tutorials/${id}/build`)
  await page.getByRole('button', { name: 'Add to My SPLAT', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Added to My SPLAT', exact: true })).toBeVisible()
})

test('Leave feedback at the end posts and lands on the same guide page with the note in view', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Feedback') })
  await addSteps(id, STEPS.slice(0, 2))

  await page.goto(`/guides/${id}`)
  const before = await page.evaluate(() => history.length)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('You built it!')).toBeVisible()

  await page.getByRole('button', { name: 'Leave feedback' }).click()
  await expect(page.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeVisible()
  // Step 2 was the last on screen, so it is already chosen: no chip tap needed.
  const body = `Great build ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const res = await post
  expect(res.status()).toBe(201)
  const created = await res.json()
  expect(created.step_position).toBe(2)
  await expect(page.getByRole('heading', { name: 'Feedback posted' })).toBeVisible()
  await page.getByRole('button', { name: 'See it on the guide' }).click()

  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  expect(await page.evaluate(() => history.length)).toBe(before + 1)   // net one entry: the build screen, not a second guide page
  await expect(page.getByRole('tab', { name: 'Feedback (1)', selected: true })).toBeVisible()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  await expect(page.getByText('Your feedback is on the guide')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Build it again' })).toBeVisible()
})

test('the step link to feedback hands off to the guide instead of opening a second copy', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const builder = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Feedback Link') })
  await addSteps(id, STEPS.slice(0, 1))
  await addNote(id, builder.id, { step_position: 1, body: 'A tip on step 1.' })
  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1' }).click()
  await page.getByText("1 note on this step in the guide's Feedback").click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  await expect(page.getByRole('tab', { name: /^Feedback/, selected: true })).toBeVisible()
  await expect(page.getByText('A tip on step 1.')).toBeVisible()
})
