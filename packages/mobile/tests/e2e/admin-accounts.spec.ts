import { test, expect } from '@playwright/test'
import { PASSWORD, adminClient, createContributor, makeLeader, uniqueTitle } from './helpers'
import { cardCount, expectCard, signInAdmin } from './admin-fixtures'

test('Q24 the Accounts card opens the list, search narrows it and Show more pages it', async ({ page }) => {
  const token = Date.now().toString(36)
  const made = await Promise.all(
    Array.from({ length: 55 }, async (_, i) => {
      const { data, error } = await adminClient().auth.admin.createUser({
        email: `acct-${token}-${i}@mobile-e2e.local`, password: PASSWORD, email_confirm: true, user_metadata: { name: `Pager ${token}` },
      })
      if (error || !data.user) throw new Error(error?.message)
      return data.user.id
    })
  )
  try {
    await signInAdmin(page)
    expect(await cardCount(page, 'Accounts')).toBeGreaterThanOrEqual(55)
    await page.getByRole('button', { name: /^Accounts, \d+$/ }).click()
    await expect(page).toHaveURL(/\/admin\/accounts$/)

    await page.getByLabel('Search accounts').fill(`acct-${token}`)
    const deletes = page.getByRole('button', { name: `Delete Pager ${token}` })
    await expect(deletes).toHaveCount(50)
    await page.getByRole('button', { name: 'Show more', exact: true }).click()
    await expect(deletes).toHaveCount(55)
    await expect(page.getByRole('button', { name: 'Show more', exact: true })).toHaveCount(0)

    await page.getByLabel('Search accounts').fill(`acct-${token}-7@`)
    await expect(deletes).toHaveCount(1)
    await expect(page.getByText(`acct-${token}-7@mobile-e2e.local`, { exact: false })).toBeVisible()
  } finally {
    await Promise.all(made.map((id) => adminClient().auth.admin.deleteUser(id)))
  }
})

test('Q25 Delete asks first, removes the account and drops the Accounts card by one', async ({ page }) => {
  const target = await createContributor()
  await adminClient().from('profiles').update({ name: uniqueTitle('Doomed') }).eq('id', target.id)
  const { data: named } = await adminClient().from('profiles').select('name').eq('id', target.id).single()
  await signInAdmin(page)
  await page.goto('/admin')
  await page.getByRole('button', { name: /^Accounts, \d+$/ }).click()
  await page.getByLabel('Search accounts').fill(target.email)
  const row = page.getByRole('button', { name: `Delete ${named!.name}` })
  await expect(row).toHaveCount(1)

  const dialogs: string[] = []
  page.once('dialog', (d) => { dialogs.push(d.message()); void d.dismiss() })
  await row.click()
  expect(dialogs[0]).toContain(`Delete ${named!.name}?`)
  await expect(row).toHaveCount(1)
  expect((await adminClient().from('profiles').select('id').eq('id', target.id).maybeSingle()).data).not.toBeNull()

  page.once('dialog', (d) => void d.accept())
  await row.click()
  await expect(row).toHaveCount(0)
  await expect.poll(async () => (await adminClient().from('profiles').select('id').eq('id', target.id).maybeSingle()).data).toBeNull()
  await expectCard(page, 'Accounts')
})

test('Q25 Delete on the only leader of an organisation is refused and the account stays', async ({ page }) => {
  const sole = await createContributor()
  await adminClient().from('profiles').update({ name: uniqueTitle('Sole leader') }).eq('id', sole.id)
  const { data: named } = await adminClient().from('profiles').select('name').eq('id', sole.id).single()
  await makeLeader(sole.id, uniqueTitle('E2E Sole Org'))
  await signInAdmin(page)

  await page.goto('/admin/accounts')
  await page.getByLabel('Search accounts').fill(sole.email)
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: `Delete ${named!.name}` }).click()
  await expect(page.getByText('Make someone else a leader first.')).toBeVisible()
  await expect(page.getByRole('button', { name: `Delete ${named!.name}` })).toHaveCount(1)
  expect((await adminClient().from('profiles').select('id').eq('id', sole.id).maybeSingle()).data).not.toBeNull()
})
