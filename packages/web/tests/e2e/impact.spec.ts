import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, createPublishedToy, deleteUser, uniqueTitle } from './helpers'

/**
 * The public showcase journey: /impact (no login) links to a contributor's
 * profile, whose tabs switch between what they wrote and what they gave.
 *
 * One contributor is seeded credited on an approved tutorial (via
 * tutorial_contributors, role='primary' — createTutorial's default) AND
 * owning a published toy, so both the wall and the profile's two tabs have
 * something real to show. public_showcase defaults to true (migration 034),
 * so no explicit opt-in is needed.
 */
test.describe('Impact wall and contributor profile', () => {
  test('wall card leads to a profile whose tabs switch content', async ({ page }) => {
    const contributor = await createContributor()
    const tutorialTitle = uniqueTitle('Impact Tutorial')
    await createTutorial(contributor.id, { title: tutorialTitle, status: 'approved' })
    const toyName = uniqueTitle('Impact Toy')
    await createPublishedToy(contributor.id, { name: toyName })

    try {
      await page.goto('/impact')

      // Headline total: the guides stat reflects the one we just seeded.
      const tutorialsStat = page.getByTestId('impact-stat-guides')
      await expect(tutorialsStat).toBeVisible()
      const statText = await tutorialsStat.textContent()
      expect(Number(statText?.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(1)

      // The contributor's own card — matched by its profile link, since the
      // display name ("E2E Contributor") is shared by every fixture contributor.
      const card = page.locator(`[data-testid="impact-card"][href="/contributors/${contributor.id}"]`)
      await expect(card).toBeVisible()
      await expect(card).toContainText(contributor.name)

      await card.click()
      await expect(page).toHaveURL(new RegExp(`/contributors/${contributor.id}$`))
      await expect(page.getByRole('heading', { level: 1, name: contributor.name })).toBeVisible()

      // Tutorials is the default active tab.
      await expect(page.getByText(tutorialTitle)).toBeVisible()

      await page.getByRole('tab', { name: 'Toys given' }).click()
      await expect(page.getByText(toyName)).toBeVisible()
      // ProfileTabs renders only the active panel's content, so the previous
      // tab's card is gone from the DOM, not just visually hidden.
      await expect(page.getByText(tutorialTitle)).toHaveCount(0)
    } finally {
      await deleteUser(contributor.id)
    }
  })
})
