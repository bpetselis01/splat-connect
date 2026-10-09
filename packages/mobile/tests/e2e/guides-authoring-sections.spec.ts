// journeys: T02 T07 T11 T16 T17 T19 T21
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, makeOrgLeader, requestBacking, selectPill, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'
import { chooseFile, PHOTO_FIXTURE } from './family-fixtures'

// The author's editor, section by section: the list's add button, Preview,
// a step photo, the three picks controls, the suits chips, withdrawing a
// backing request, and the footer's Next. Each test seeds its own guide.

test('"+ Add a tutorial" on My tutorials opens the new-guide screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Add Row'), status: 'draft' })

  await page.goto('/tutorials')
  await page.getByRole('button', { name: '+ Add a tutorial', exact: true }).click()
  await expect(page).toHaveURL(/\/guides\/new$/)
  await expect(page.getByPlaceholder('Title')).toBeVisible()
})

test('Preview on the hub opens the guide as a reader sees it', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Preview Guide')
  const id = await createTutorial(contributor.id, { title })

  await page.goto(`/tutorials/${id}`)
  await page.getByTestId('hub-preview').click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  // The hub stays mounted under the pushed screen, so the reader's copy is the last match.
  await expect(page.getByText(title).last()).toBeVisible()
})

test('a step photo uploads, shows, and is stored on the step row', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Step Photo'), status: 'draft' })
  await addSteps(id, [{ body: 'Open the lid.' }])

  await page.goto(`/tutorials/${id}/steps`)
  const put = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/steps`) && r.request().method() === 'PUT')
  await chooseFile(page, { testId: 'step-photo-0' }, PHOTO_FIXTURE)
  expect((await put).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Replace photo' })).toBeVisible()

  const { data } = await adminClient().from('tutorial_steps').select('photo_url').eq('tutorial_id', id).eq('position', 1).single()
  expect(data?.photo_url).toBeTruthy()
})

test('picks: Add, Required first and Remove each write the recommendation rows', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Picks Host'), status: 'draft' })
  const otherTitle = uniqueTitle('E2E Pick Target')
  const otherId = await createTutorial(contributor.id, { title: otherTitle })
  const rows = async () => {
    const { data } = await adminClient().from('tutorial_recommendations').select('recommended_id, required').eq('tutorial_id', id)
    return data ?? []
  }
  const posted = () => page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/recommendations`) && r.request().method() === 'POST')

  await page.goto(`/tutorials/${id}/picks`)
  let res = posted()
  await page.getByRole('button', { name: `Add ${otherTitle}`, exact: true }).click()
  expect((await res).ok()).toBe(true)
  await expect(page.getByRole('button', { name: `Remove ${otherTitle}`, exact: true })).toBeVisible()
  expect(await rows()).toEqual([{ recommended_id: otherId, required: false }])

  res = posted()
  await page.getByRole('button', { name: 'Required first', exact: true }).click()
  expect((await res).ok()).toBe(true)
  await expect.poll(rows).toEqual([{ recommended_id: otherId, required: true }])

  res = posted()
  await page.getByRole('button', { name: `Remove ${otherTitle}`, exact: true }).click()
  expect((await res).ok()).toBe(true)
  await expect(page.getByRole('button', { name: `Add ${otherTitle}`, exact: true })).toBeVisible()
  expect(await rows()).toEqual([])
})

test('the suits chips save to the guide row', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Suits'), status: 'draft' })

  await page.goto(`/tutorials/${id}/suits`)
  const patched = () => page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'PATCH')
  let saved = patched()
  await selectPill(page, 'Switch')
  expect((await saved).status()).toBe(200)
  saved = patched()
  await selectPill(page, 'Communicating')
  expect((await saved).status()).toBe(200)

  const { data } = await adminClient().from('tutorials').select('device_types, helps_with').eq('id', id).single()
  expect(data?.device_types).toEqual(['switch'])
  expect(data?.helps_with).toEqual(['communicating'])
})

test('Withdraw drops the backing request and offers the organisation again', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Withdraw'), status: 'draft' })
  const leader = (await createContributor()).id
  const orgName = uniqueTitle('E2E Backing Org')
  const orgId = await makeOrgLeader(leader, orgName)
  await requestBacking(id, orgId, 'pending')

  await page.goto(`/tutorials/${id}/backing`)
  await expect(page.getByText(orgName, { exact: true })).toBeVisible()
  const del = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/orgs/${orgId}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: `Withdraw from ${orgName}`, exact: true }).click()
  expect((await del).ok()).toBe(true)
  await expect(page.getByRole('button', { name: `Ask ${orgName}`, exact: true })).toBeVisible()

  const { data } = await adminClient().from('tutorial_orgs').select('org_id').eq('tutorial_id', id).eq('org_id', orgId)
  expect(data).toEqual([])
})

test('the section footer\'s Next goes to the next gap and Checklist returns to the hub', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Footer'), status: 'draft', withPdf: false, withSteps: false })

  await page.goto(`/tutorials/${id}/details`)
  await page.getByTestId('section-next').click()
  await expect(page).not.toHaveURL(/\/details$/)
  await expect(page).toHaveURL(new RegExp(`/tutorials/${id}/[a-z]+$`))
  await expect(page.getByTestId('section-next')).toBeVisible()

  await page.getByTestId('section-back').click()
  await expect(page.getByTestId('hub-submit')).toBeVisible()
})
