import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, createPublishedToy, deleteUser, signIn, uniqueTitle } from '../helpers'

/**
 * Browsing the toy library and looking at one toy, signed out and signed in.
 * Asking for a toy (the request form and the thread behind it) is the Gift and
 * Swap specs' job under tests/e2e/exchanges/.
 */
test.describe('Toy library', () => {
  test('WY01 WY02 a guest narrows the grid by how a toy is offered and opens a card', async ({ page }) => {
    const holder = await createContributor()
    const gift = uniqueTitle('Gift bear')
    const swap = uniqueTitle('Swap bear')
    const giftId = await createPublishedToy(holder.id, { name: gift, offer_type: 'donation' })
    await createPublishedToy(holder.id, { name: swap, offer_type: 'exchange' })
    try {
      await page.goto('/toy-library')
      await expect(page.getByTestId('toy-library-card').filter({ hasText: gift })).toBeVisible()
      await expect(page.getByTestId('toy-library-card').filter({ hasText: swap })).toBeVisible()

      await page.getByRole('button', { name: 'Swap only', exact: true }).click()
      await expect(page.getByTestId('toy-library-card').filter({ hasText: swap })).toBeVisible()
      await expect(page.getByTestId('toy-library-card').filter({ hasText: gift })).toHaveCount(0)

      await page.getByRole('button', { name: 'Swap only', exact: true }).click()
      await page.getByRole('button', { name: 'Gift', exact: true }).click()
      await expect(page.getByTestId('toy-library-card').filter({ hasText: swap })).toHaveCount(0)
      await page.getByTestId('toy-library-card').filter({ hasText: gift }).click()
      await expect(page).toHaveURL(new RegExp(`/toy-library/${giftId}$`))
      await expect(page.getByRole('heading', { level: 1, name: gift })).toBeVisible()
    } finally {
      await deleteUser(holder.id)
    }
  })

  test('WY03 a guest is sent to sign up from a card heart; a member saves it and it survives a reload', async ({ page }) => {
    const holder = await createContributor()
    const member = await createContributor()
    await acceptTerms(member.id)
    const name = uniqueTitle('Saved bear')
    await createPublishedToy(holder.id, { name })
    try {
      await page.goto('/toy-library')
      await page.getByTestId('toy-library-card').filter({ hasText: name }).locator('..').getByRole('button', { name: 'Save' }).click()
      await expect(page).toHaveURL(/\/signup\?next=%2Ftoy-library&reason=save/)

      await signIn(page, member.email, member.password)
      await page.goto('/toy-library')
      const heart = () => page.locator('.save-host', { hasText: name }).getByRole('button', { name: /^Save/ })
      await heart().click()
      await expect(heart()).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await expect(heart()).toHaveAttribute('aria-pressed', 'true')
      await page.goto('/dashboard/saved/toys')
      await expect(page.getByText(name)).toBeVisible()
    } finally {
      await deleteUser(holder.id)
      await deleteUser(member.id)
    }
  })

  test('WY07 a guest on a toy is sent to sign in and returned to its request form', async ({ page }) => {
    const holder = await createContributor()
    const member = await createContributor()
    await acceptTerms(member.id)
    const toyId = await createPublishedToy(holder.id, { name: uniqueTitle('Sign in bear'), offer_type: 'donation' })
    try {
      await page.goto(`/toy-library/${toyId}`)
      await page.getByRole('link', { name: 'Sign in to ask for it' }).click()
      await expect(page).toHaveURL(new RegExp(`/login\\?next=.*${toyId}.*request`))
      await page.locator('#email').fill(member.email)
      await page.locator('#password').fill(member.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(new RegExp(`/toy-library/${toyId}/request\\?mode=donation$`))
      await expect(page.getByLabel(/Say who it is for/)).toBeVisible()
    } finally {
      await deleteUser(holder.id)
      await deleteUser(member.id)
    }
  })

  test('WY06 WY08 WY09 a member opens the request form, saves the toy and reports the listing', async ({ page }) => {
    const holder = await createContributor()
    const member = await createContributor()
    await acceptTerms(member.id)
    const name = uniqueTitle('Detail bear')
    const toyId = await createPublishedToy(holder.id, { name, offer_type: 'both' })
    try {
      await signIn(page, member.email, member.password)
      await page.goto(`/toy-library/${toyId}`)

      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')

      await page.getByRole('button', { name: /Report this listing/ }).click()
      await page.getByRole('radio', { name: /Wrong or missing info/ }).click()
      await page.getByPlaceholder(/What you expected/).fill('The photo shows another toy.')
      await page.getByRole('button', { name: /Send to SPLAT/ }).click()
      await expect(page.getByText('Sent to SPLAT. You will hear back within two days.')).toBeVisible()
      await page.keyboard.press('Escape')

      await page.getByRole('link', { name: 'Offer a swap' }).click()
      await expect(page).toHaveURL(new RegExp(`/toy-library/${toyId}/request\\?mode=exchange`))
      await expect(page.getByRole('heading', { level: 1 })).toContainText(`for ${name}`)
    } finally {
      await deleteUser(holder.id)
      await deleteUser(member.id)
    }
  })
})
