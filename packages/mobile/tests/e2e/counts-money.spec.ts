// journeys: X10 X11 X12
import { test, expect } from '@playwright/test'
import { adminClient } from './helpers'
import { partyPage, seedBuild } from './maker-fixtures'

/**
 * The money panel on Me follows the cost panel on a build thread, with no
 * reload: Me stays mounted under the pushed thread and refetches on focus.
 * The maker adds and removes a line; the family settles. Each step checks the
 * exchange_costs row, the maker's Me panel (reached by going back from the
 * thread) and the family's Me total (reached by leaving and re-entering the tab).
 */

test.setTimeout(120_000)

async function costRows(transactionId: string) {
  const { data, error } = await adminClient()
    .from('exchange_costs')
    .select('description, amount_cents, claiming, payer_id, payee_id, settled_at, created_by')
    .eq('transaction_id', transactionId)
    .order('created_at')
  if (error) throw new Error(`costRows failed: ${error.message}`)
  return data ?? []
}

test('adding, removing and settling cost lines moves the Me money panel without a reload', async ({ browser, baseURL }) => {
  const build = await seedBuild({ status: 'accepted' })
  const { error: seedError } = await adminClient().from('exchange_costs').insert({
    transaction_id: build.id,
    description: 'Filament',
    amount_cents: 500,
    claiming: true,
    payer_id: build.requester.id,
    payee_id: build.maker.id,
    created_by: build.maker.id,
  })
  if (seedError) throw new Error(`seed cost failed: ${seedError.message}`)

  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)
  const meTotal = (p: typeof makerPage) => p.getByText(/^\$\d+\.\d\d$/).first()
  const line = (p: typeof makerPage, what: string) => p.getByRole('button', { name: new RegExp(`^${what},`) })

  try {
    // Both open Me first, so a stale panel would show the old number below.
    await makerPage.goto('/me')
    await familyPage.goto('/me')
    await expect(line(makerPage, 'Filament')).toHaveAccessibleName(/\$5\.00, to settle$/)
    await expect(meTotal(familyPage)).toHaveText('$5.00')
    const toHome = async (p: typeof makerPage) => {
      await p.getByRole('tab', { name: 'Home', exact: true }).click()
      // The tab's name carries its badge ("Me, 1 waiting"), so match its start.
      await p.getByRole('tab', { name: /^Me/ }).click()
    }

    // X10: the maker adds a line from the thread's cost panel.
        await line(makerPage, 'Filament').click()
    await expect(makerPage).toHaveURL(new RegExp(`/exchanges/build/${build.id}$`))
    await makerPage.getByLabel('What the money went on').fill('Nozzle')
    await makerPage.getByLabel('Amount in dollars').fill('7.50')
    await makerPage.getByRole('button', { name: 'Add a line' }).click()
    await expect(makerPage.getByText('Nozzle', { exact: true })).toBeVisible()
    expect(await costRows(build.id)).toMatchObject([
      { description: 'Filament', amount_cents: 500 },
      { description: 'Nozzle', amount_cents: 750, claiming: true, payer_id: build.requester.id, payee_id: build.maker.id, settled_at: null },
    ])
    await makerPage.goBack()
    await expect(line(makerPage, 'Nozzle, Filament')).toHaveAccessibleName(/\$12\.50, to settle$/)
    await toHome(familyPage)
    await expect(meTotal(familyPage)).toHaveText('$12.50')

    // X11: the maker removes the line again.
        await line(makerPage, 'Nozzle, Filament').click()
    await expect(makerPage.getByText('Nozzle', { exact: true })).toBeVisible()
    await makerPage.getByRole('button', { name: 'Remove this line' }).last().click()
    await expect(makerPage.getByText('Nozzle', { exact: true })).toHaveCount(0)
    expect(await costRows(build.id)).toMatchObject([{ description: 'Filament', amount_cents: 500 }])
    expect(await costRows(build.id)).toHaveLength(1)
    await makerPage.goBack()
    await expect(line(makerPage, 'Filament')).toHaveAccessibleName(/\$5\.00, to settle$/)
    await toHome(familyPage)
    await expect(meTotal(familyPage)).toHaveText('$5.00')

    // X12: the family marks it settled, and "To settle" turns to "Settled".
    await line(familyPage, 'Filament').click()
    await expect(familyPage).toHaveURL(new RegExp(`/exchanges/build/${build.id}$`))
    await familyPage.getByRole('button', { name: 'Mark as settled' }).click()
    await expect(familyPage.getByRole('button', { name: 'Marked as settled' })).toBeVisible()
    const [settled] = await costRows(build.id)
    expect(settled).toMatchObject({ description: 'Filament' })
    expect(settled!.settled_at).not.toBeNull()
    await familyPage.goBack()
    await expect(line(familyPage, 'Filament')).toHaveAccessibleName(/\$5\.00, settled$/)
    await expect(meTotal(familyPage)).toHaveText('$0.00')
    await expect(familyPage.getByText('All settled — nothing outstanding.')).toBeVisible()
    await toHome(makerPage)
    await expect(line(makerPage, 'Filament')).toHaveAccessibleName(/\$5\.00, settled$/)
  } finally {
    await makerPage.context().close()
    await familyPage.context().close()
  }
})
