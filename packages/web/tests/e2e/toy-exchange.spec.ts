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
 * The three lifecycle tests share one `page` and re-sign in between owner and
 * requester, mirroring collaborators.spec.ts: none of their assertions needs
 * both parties visible at once. The liveness test at the bottom is the
 * exception — its whole claim is about what one party's screen does while the
 * other acts, which cannot be observed by a browser that signed the first party
 * out — so it alone runs two contexts.
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

      // The toy left the donor's hands, so it leaves their list entirely —
      // it is not archived, it belongs to someone else now.
      await page.goto('/dashboard/toys')
      await expect(page.getByText('Fire truck')).toHaveCount(0)

      // And it is waiting for the requester, unlisted, with the thread offering
      // them the way to list it.
      await signIn(page, requester.email, requester.password)
      await page.waitForURL('**/dashboard')
      await page.goto(txUrl)
      await page.getByRole('link', { name: /add to toy library/i }).click()
      await expect(page).toHaveURL(/\/dashboard\/toys\//)
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

  /**
   * The one test that proves the thread is live, and the only one that needs
   * both parties on screen at once: every assertion below is made against a
   * page that is never navigated or reloaded after it is opened. A goto()
   * anywhere in the second half would make this pass whether or not the
   * subscription exists.
   *
   * Two claims, because they run through different halves of the same channel:
   * a typed message (a kind='user' row, rendered straight into the log), and an
   * acceptance (a kind='system' row, whose real effect is that the refetch
   * brings a new tx.status with it and the sidebar changes).
   */
  test('a message and an acceptance reach the other party without a reload', async ({ browser }) => {
    const owner = await createContributor()
    await acceptTerms(owner.id)
    const requester = await createContributor()
    await acceptTerms(requester.id)
    const toyId = await createPublishedToy(owner.id, { name: 'Digger', offer_type: 'donation' })

    const requesterContext = await browser.newContext()
    const ownerContext = await browser.newContext()
    const requesterPage = await requesterContext.newPage()
    const ownerPage = await ownerContext.newPage()

    try {
      await signIn(requesterPage, requester.email, requester.password)
      await requesterPage.waitForURL('**/dashboard')
      await requesterPage.goto(`/toy-library/${toyId}`)
      await requesterPage.getByRole('button', { name: 'Arrange pickup' }).click()
      await expect(requesterPage).toHaveURL(/\/dashboard\/exchanges\//)
      const txUrl = requesterPage.url()

      await signIn(ownerPage, owner.email, owner.password)
      await ownerPage.waitForURL('**/dashboard')
      await ownerPage.goto(txUrl)
      // Both pages are now settled on the thread. Neither navigates again.

      const question = 'Is the digger still available?'
      await requesterPage.getByLabel(/^Message /).fill(question)
      await requesterPage.getByRole('button', { name: 'Send' }).click()
      await expect(ownerPage.getByText(question)).toBeVisible()

      await ownerPage.getByRole('button', { name: 'Accept' }).click()
      await ownerPage.getByLabel('Street address').fill('2 Live St')
      await ownerPage.getByLabel('Suburb').fill('Testville')
      await ownerPage.getByLabel('State').fill('VIC')
      await ownerPage.getByLabel('Postcode').fill('3000')
      await ownerPage.getByRole('button', { name: 'Accept request' }).click()

      // The requester never asked for any of this: the address, the status and
      // their handoff code all arrive on a page that has sat still since it
      // sent a message.
      await expect(requesterPage.getByText('2 Live St, Testville, VIC, 3000')).toBeVisible()
      await expect(requesterPage.getByText(/your handoff code/i)).toBeVisible()
    } finally {
      await requesterContext.close()
      await ownerContext.close()
      await deleteUser(owner.id)
      await deleteUser(requester.id)
    }
  })
})
