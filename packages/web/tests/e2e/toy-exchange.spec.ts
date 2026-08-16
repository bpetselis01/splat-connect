import { test, expect } from '@playwright/test'
import { createContributor, createPublishedToy, signIn, deleteUser, acceptTerms } from './helpers'

/**
 * Donation handoff, owner rejection, and requester withdrawal — the three
 * terminal paths through ToyTransactionThread (packages/web/components/
 * toy-transaction-thread.tsx). Each party's UI has its own coverage
 * (toy-transaction-request.test.tsx, toy-transaction-thread.test.tsx); this
 * proves the whole loop is wired end to end through real navigation, the
 * way collaborators.spec.ts proves the invite loop.
 *
 * Single shared `page`, re-signing in between owner and requester, mirrors
 * collaborators.spec.ts rather than the brief's multi-context illustration —
 * no assertion here needs both parties visible at once.
 *
 * For a donation (not exchange), ToyTransactionThread only shows "Your
 * handoff code" to the requester (showMyCode = type === 'exchange' ||
 * !isOwner) and only lets the owner submit the confirm form (canConfirm =
 * type === 'exchange' || isOwner) — the owner never sees their own code,
 * they just key in the requester's.
 */
test.describe('Toy donation and exchange', () => {
  test('a requester can complete a donation handoff end to end', async ({ page }) => {
    const owner = await createContributor()
    await acceptTerms(owner.id)
    const requester = await createContributor()
    await acceptTerms(requester.id)
    const toyId = await createPublishedToy(owner.id, { name: 'Fire truck', offer_type: 'donation' })

    try {
      await signIn(page, requester.email, requester.password)
      await page.waitForURL('**/dashboard')
      await page.goto(`/toy-library/${toyId}`)
      await page.getByRole('button', { name: 'Arrange pickup' }).click()
      await expect(page).toHaveURL(/\/dashboard\/exchanges\//)
      const txUrl = page.url()

      await signIn(page, owner.email, owner.password)
      await page.waitForURL('**/dashboard')
      await page.goto(txUrl)
      // Accept opens the pickup dialog rather than accepting outright. This
      // owner has no saved address, so the fields show directly with no
      // "use my saved address" choice to make first.
      await page.getByRole('button', { name: 'Accept' }).click()
      await page.getByLabel('Street address').fill('1 Test St')
      await page.getByLabel('Suburb').fill('Testville')
      await page.getByLabel('State').fill('VIC')
      await page.getByLabel('Postcode').fill('3000')
      await page.getByRole('button', { name: 'Accept request' }).click()
      await expect(page.getByText('1 Test St, Testville, VIC, 3000')).toBeVisible()

      // The requester's code only appears once they reload the accepted thread.
      await signIn(page, requester.email, requester.password)
      await page.waitForURL('**/dashboard')
      await page.goto(txUrl)
      await expect(page.getByText(/your handoff code/i)).toBeVisible()
      const codeText = await page.getByText(/your handoff code/i).textContent()
      const requesterCode = codeText?.match(/\d{6}/)?.[0]
      expect(requesterCode).toBeTruthy()

      await signIn(page, owner.email, owner.password)
      await page.waitForURL('**/dashboard')
      await page.goto(txUrl)
      await page.getByLabel(/other party's code/i).fill(requesterCode!)
      await page.getByRole('button', { name: 'Confirm handoff' }).click()
      await expect(page.getByText(/handoff complete/i)).toBeVisible()

      await page.goto('/dashboard/toys')
      await expect(page.getByRole('heading', { name: 'Archived' })).toBeVisible()
      await expect(page.getByText('Fire truck')).toBeVisible()
    } finally {
      await deleteUser(owner.id)
      await deleteUser(requester.id)
    }
  })

  test('the owner can reject a request, ending it with no handoff', async ({ page }) => {
    const owner = await createContributor()
    await acceptTerms(owner.id)
    const requester = await createContributor()
    await acceptTerms(requester.id)
    const toyId = await createPublishedToy(owner.id, { name: 'Robot', offer_type: 'donation' })

    try {
      await signIn(page, requester.email, requester.password)
      await page.waitForURL('**/dashboard')
      await page.goto(`/toy-library/${toyId}`)
      await page.getByRole('button', { name: 'Arrange pickup' }).click()
      await expect(page).toHaveURL(/\/dashboard\/exchanges\//)
      const txUrl = page.url()

      await signIn(page, owner.email, owner.password)
      await page.waitForURL('**/dashboard')
      await page.goto(txUrl)
      await page.getByRole('button', { name: 'Reject' }).click()
      await expect(page.getByText(/this request was declined/i)).toBeVisible()
    } finally {
      await deleteUser(owner.id)
      await deleteUser(requester.id)
    }
  })

  test('a requester can withdraw an open request', async ({ page }) => {
    const owner = await createContributor()
    await acceptTerms(owner.id)
    const requester = await createContributor()
    await acceptTerms(requester.id)
    const toyId = await createPublishedToy(owner.id, { name: 'Kite', offer_type: 'donation' })

    try {
      await signIn(page, requester.email, requester.password)
      await page.waitForURL('**/dashboard')
      await page.goto(`/toy-library/${toyId}`)
      await page.getByRole('button', { name: 'Arrange pickup' }).click()
      await expect(page).toHaveURL(/\/dashboard\/exchanges\//)

      await page.getByRole('button', { name: 'Withdraw' }).click()
      await expect(page.getByText(/this request was withdrawn/i)).toBeVisible()
    } finally {
      await deleteUser(owner.id)
      await deleteUser(requester.id)
    }
  })
})
