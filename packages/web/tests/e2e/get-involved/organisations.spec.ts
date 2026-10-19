import { test, expect } from '@playwright/test'
import { adminClient, createContributor, deleteUser, signIn, uniqueTitle } from '../helpers'

test('WI08 a member asks for an organisation and the page reads "Sent for verification"', async ({ page }) => {
  const member = await createContributor()
  const orgName = uniqueTitle('Eastside Therapy')
  try {
    await signIn(page, member.email, member.password)
    await page.goto('/get-involved/organisations/request')
    await page.getByLabel('Organisation name').fill(orgName)
    await page.getByLabel('What it does').fill('Paediatric OT, twelve therapists.')
    await page.getByLabel('How we can check you work there').fill('My work email is on eastside.example.')
    await page.getByRole('button', { name: 'Send for verification' }).click()

    await expect(page.getByRole('heading', { name: 'Sent for verification' })).toBeVisible()
    await expect(page.getByText(orgName, { exact: false }).first()).toBeVisible()
    const { data } = await adminClient()
      .from('organization_requests')
      .select('status, requester_id')
      .eq('org_name', orgName)
      .single()
    expect(data).toEqual({ status: 'pending', requester_id: member.id })
  } finally {
    await adminClient().from('organization_requests').delete().eq('requester_id', member.id)
    await deleteUser(member.id)
  }
})

test('WI09 a signed-out visitor sees the lock card and signs in to come back to the request', async ({ page }) => {
  await page.goto('/get-involved/organisations/request')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to request your organisation' })).toBeVisible()
  await expect(page.getByLabel('Organisation name')).toHaveCount(0)
  await page.getByRole('link', { name: 'Sign in or create an account' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fget-involved%2Forganisations%2Frequest$/)
})
