import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, acceptTerms, deleteUser } from '../helpers'

const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('a contributor adds a toy, edits it, uploads a cover photo, publishes it, and deletes it', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.goto('/dashboard/toys')
    await page.getByRole('link', { name: 'Add a toy' }).click()
    await page.waitForURL('**/dashboard/toys/new')
    await expect(page.getByRole('tab', { name: 'Photos' })).toBeDisabled()
    await page.locator('#new-toy-name').fill('E2E Test Toy')
    await page.locator('#new-toy-condition').fill('6')
    await page.locator('#new-toy-description').fill('A toy created by Playwright.')
    await page.getByRole('button', { name: 'Create' }).click()
    // Creation hands straight over to Photos, the step that was locked before
    // the toy existed.
    await page.waitForURL(/\/dashboard\/toys\/[0-9a-f-]{36}\?step=photos$/)
    await expect(page.getByRole('heading', { name: 'E2E Test Toy' })).toBeVisible()

    await page.getByRole('tab', { name: 'Details' }).click()
    await page.locator('#toy-condition').fill('9')
    await page.getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: the rail now carries a "Saved" row of its own, so an
    // unscoped getByText('Saved') matches the nav item as well as this
    // confirmation and trips strict mode. The confirmation is page content;
    // the row is navigation.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()

    await page.getByRole('tab', { name: 'Review' }).click()
    // The pointer is still resting on the pill just clicked. Its active colour
    // (--color-ink since the pixel register, 03ef998e) has to survive :hover,
    // or every selection looks like it did not take.
    await expect(page.getByRole('tab', { name: 'Review' })).toHaveCSS(
      'background-color',
      'rgb(18, 40, 58)'
    )
    // The review tab carries the same finish bar as the tutorial editor: a
    // count, and each gap as a button that jumps to the step that fixes it.
    await expect(page.getByText('2 things left')).toBeVisible()
    await expect(page.getByRole('button', { name: 'A photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await page.getByRole('tab', { name: 'Photos' }).click()
    // One box now, and no Save beside it: a photo uploads and saves as it is
    // added, so the tile appearing IS the confirmation. Save on this step
    // belongs to the switch-adapted checkbox alone.
    await page.locator('#toy-add-photo').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByText('Cover')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('tab', { name: 'Review' }).click()
    // Publish also needs an offer type, so the photo alone does not unlock it.
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await page.getByRole('button', { name: 'Donation' }).click()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled()
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published')).toBeVisible()

    await page.goto('/dashboard/toys')
    const card = page.getByRole('link', { name: /E2E Test Toy/ })
    await expect(card).toBeVisible()
    // Positive assertion now that published carries its own badge: the old
    // "no Draft text" check would pass on a draft too, since the badge reads
    // DRAFT and getByText is case-sensitive.
    await expect(card.getByText('PUBLISHED')).toBeVisible()
    await expect(card.getByText('DRAFT')).toHaveCount(0)

    await card.click()
    await page.getByRole('button', { name: 'Delete toy' }).click()
    await page.getByLabel(/to confirm/i).fill('confirm_delete_toy')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForURL('**/dashboard/toys')
    await expect(page.getByText('E2E Test Toy')).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})
