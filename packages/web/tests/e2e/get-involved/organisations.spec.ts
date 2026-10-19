import { test, expect } from '@playwright/test'
import {
  acceptTerms, adminClient, createContributor, createEvent, createOrg, deleteOrg, deleteUser, makeLeader, signIn, uniqueTitle,
} from '../helpers'

type Member = Awaited<ReturnType<typeof createContributor>>

async function named(name: string, terms = true): Promise<Member> {
  const m = await createContributor()
  await adminClient().from('profiles').update({ name }).eq('id', m.id)
  if (terms) await acceptTerms(m.id)
  return { ...m, name }
}

async function publicOrg(name: string, over: Record<string, unknown> = {}) {
  const id = await createOrg(name)
  const { error } = await adminClient().from('organizations').update(over).eq('id', id)
  if (error) throw new Error(`publicOrg failed: ${error.message}`)
  return id
}

async function tidy(orgIds: string[], members: Member[]) {
  await Promise.all(orgIds.map((id) => deleteOrg(id)))
  await Promise.all(members.map((m) => deleteUser(m.id)))
}

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

test('WN01 WN02 the directory searches by name, filters to organisations that take plastic, and a card opens the profile', async ({ page }) => {
  const stamp = Date.now()
  const plastic = await publicOrg(`Zephyr Plastic ${stamp}`, { recycling_materials: ['PLA'] })
  const plain = await publicOrg(`Zephyr Plain ${stamp}`)
  try {
    await page.goto('/organizations')
    await page.getByRole('searchbox', { name: 'Search organisations' }).fill(`Zephyr`)
    await page.getByRole('searchbox', { name: 'Search organisations' }).press('Enter')
    await expect(page).toHaveURL(/\/organizations\?q=Zephyr$/)
    await expect(page.getByRole('link', { name: new RegExp(`Zephyr Plastic ${stamp}`) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`Zephyr Plain ${stamp}`) })).toBeVisible()

    await page.getByRole('link', { name: 'Takes plastic', exact: true }).click()
    await expect(page).toHaveURL(/\/organizations\?q=Zephyr&f=plastic$/)
    await expect(page.getByRole('link', { name: new RegExp(`Zephyr Plain ${stamp}`) })).toHaveCount(0)
    await page.getByRole('link', { name: new RegExp(`Zephyr Plastic ${stamp}`) }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${plastic}/public$`))
    await expect(page.getByRole('heading', { level: 1, name: `Zephyr Plastic ${stamp}` })).toBeVisible()
  } finally {
    await tidy([plastic, plain], [])
  }
})

test('WN03 a signed-in member without the contributor terms is sent to the terms page, where a signed-out visitor is not (Q4)', async ({ page }) => {
  await page.goto('/organizations')
  await expect(page.getByRole('heading', { level: 1, name: 'Organisations' })).toBeVisible()

  const member = await named('Priya Nair', false)
  try {
    await signIn(page, member.email, member.password)
    await page.goto('/organizations')
    await expect(page).toHaveURL(/\/onboarding\/contributor-terms\?next=%2Forganizations$/)
  } finally {
    await deleteUser(member.id)
  }
})

test('WN04 a non-leader is sent to the public profile and a leader gets the workspace', async ({ page }) => {
  const name = uniqueTitle('Northbank Therapy')
  const orgId = await publicOrg(name)
  const family = await named('Priya Nair')
  const leader = await named('Rachel Leader')
  await makeLeader(leader.id, undefined, orgId)
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}`)
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}/public$`))

    await page.context().clearCookies()
    await signIn(page, leader.email, leader.password)
    await page.goto(`/organizations/${orgId}`)
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}$`))
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText(/Waiting on you/i)).toBeVisible()
  } finally {
    await tidy([orgId], [family, leader])
  }
})

test('WN05 a leader who has not accepted the leader terms accepts them from the banner', async ({ page }) => {
  const orgId = await publicOrg(uniqueTitle('Northbank Therapy'))
  const leader = await named('Rachel Leader')
  await adminClient().from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
  try {
    await signIn(page, leader.email, leader.password)
    await page.goto(`/organizations/${orgId}`)
    await expect(page.getByRole('heading', { name: 'Accept the leader terms to review' })).toBeVisible()
    await page.getByRole('button', { name: /I accept/i }).click()
    await expect(page.getByRole('heading', { name: 'Accept the leader terms to review' })).toHaveCount(0)
    const { data } = await adminClient().from('user_agreements').select('agreement_type').eq('user_id', leader.id).eq('agreement_type', 'org_leader_terms')
    expect(data).toEqual([{ agreement_type: 'org_leader_terms' }])
  } finally {
    await tidy([orgId], [leader])
  }
})

test('WN06 WN11 anyone reads the public profile, and the recycling card follows who is signed in', async ({ page }) => {
  const name = uniqueTitle('Northbank Therapy')
  const orgId = await publicOrg(name, {
    about: 'We run a monthly build day for local families.', suburb: 'Newtown', state: 'NSW',
    capabilities: ['Has a printer'], recycling_materials: ['PLA'],
  })
  const leader = await named('Rachel Leader')
  const family = await named('Priya Nair')
  await makeLeader(leader.id, undefined, orgId)
  const eventId = await createEvent(orgId, leader.id, { status: 'published', title: uniqueTitle('Switch build day') })
  const { data: ev } = await adminClient().from('org_events').select('title').eq('id', eventId).single()
  try {
    await page.goto(`/organizations/${orgId}/public`)
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(page.getByText('We run a monthly build day for local families.')).toBeVisible()
    await expect(page.getByText('Newtown, NSW').first()).toBeVisible()
    await expect(page.getByText('Has a printer').first()).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(ev!.title) }).first()).toHaveAttribute('href', `/get-involved/events/${eventId}`)
    await page.getByRole('link', { name: 'How recycling works' }).click()
    await expect(page).toHaveURL(/\/get-involved\/recycling$/)

    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('link', { name: 'Book a drop-off' }).click()
    await expect(page).toHaveURL(new RegExp(`/get-involved/recycling/drop-off\\?org=${orgId}$`))
  } finally {
    await tidy([orgId], [leader, family])
  }
})

test('WN07 a member follows an organisation and unfollows it, and a visitor is sent to sign up', async ({ page }) => {
  const orgId = await publicOrg(uniqueTitle('Northbank Therapy'))
  const family = await named('Priya Nair')
  try {
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('button', { name: 'Follow' }).click()
    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Forganizations%2F${orgId}%2Fpublic&reason=follow$`))

    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('button', { name: 'Follow' }).click()
    // Current behaviour: the page has no ToastProvider, so the "You will hear when…" toast is never drawn.
    await expect(page.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true')
    const follows = () => adminClient().from('org_follows').select('profile_id').eq('org_id', orgId)
    expect((await follows()).data).toEqual([{ profile_id: family.id }])

    await page.getByRole('button', { name: 'Following' }).click()
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(async () => (await follows()).data).toEqual([])
  } finally {
    await tidy([orgId], [family])
  }
})

test('WN08 the Message button opens the message page for a member and sign-up for a visitor', async ({ page }) => {
  const orgId = await publicOrg(uniqueTitle('Northbank Therapy'))
  const family = await named('Priya Nair')
  try {
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('link', { name: 'Message' }).click()
    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Forganizations%2F${orgId}%2Fpublic&reason=message$`))

    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('link', { name: 'Message' }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}/message$`))
  } finally {
    await tidy([orgId], [family])
  }
})

test('WN09 a member says thanks to an organisation and its leader is told', async ({ page }) => {
  const name = uniqueTitle('Northbank Therapy')
  const orgId = await publicOrg(name)
  const family = await named('Priya Nair')
  const leader = await named('Rachel Leader')
  await makeLeader(leader.id, undefined, orgId)
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}/public`)
    await page.getByRole('button', { name: 'Say thanks' }).click()
    await expect(page.getByLabel(/sign it as/i)).toHaveValue('Priya')
    await page.getByPlaceholder(/what they did/i).fill('The switch clinic changed our Thursdays.')
    await page.getByRole('button', { name: /send thanks/i }).click()
    await expect(page.getByRole('button', { name: 'Thanked' })).toBeDisabled()
    await expect(page.getByText(/Thanked 1 time/)).toBeVisible()
    const { data } = await adminClient().from('notifications').select('recipient_id, type, actor_name').eq('org_id', orgId)
    expect(data).toEqual([{ recipient_id: leader.id, type: 'org_thanked', actor_name: 'Priya' }])
  } finally {
    await tidy([orgId], [family, leader])
  }
})

test('WN10 a leader of the organisation sees Edit your page instead of Follow, Message and Say thanks', async ({ page }) => {
  const orgId = await publicOrg(uniqueTitle('Northbank Therapy'))
  const leader = await named('Rachel Leader')
  await makeLeader(leader.id, undefined, orgId)
  try {
    await signIn(page, leader.email, leader.password)
    await page.goto(`/organizations/${orgId}/public`)
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Say thanks' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Edit your page' }).click()
    await expect(page).toHaveURL(/\/dashboard\/organisation\/profile$/)
  } finally {
    await tidy([orgId], [leader])
  }
})

test('WN12 a member messages an organisation and its leader gets an org_message inbox row', async ({ page }) => {
  const name = uniqueTitle('Northbank Therapy')
  const orgId = await publicOrg(name)
  const family = await named('Priya Nair')
  const leader = await named('Rachel Leader')
  await makeLeader(leader.id, undefined, orgId)
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/organizations/${orgId}/message`)
    await expect(page.getByRole('heading', { level: 1, name: `Message ${name}` })).toBeVisible()
    await page.getByPlaceholder('Write a message').fill('Can we come on Thursday?')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByRole('log', { name: 'Conversation' }).getByText('Can we come on Thursday?')).toBeVisible()

    const { data } = await adminClient().from('notifications').select('recipient_id, type').eq('type', 'org_message').eq('recipient_id', leader.id)
    expect(data).toEqual([{ recipient_id: leader.id, type: 'org_message' }])

    await page.context().clearCookies()
    await signIn(page, leader.email, leader.password)
    await page.goto('/notifications')
    await expect(page.getByText(`Priya Nair messaged ${name}`)).toBeVisible()
    await page.goto('/dashboard/organisation/messages')
    await expect(page.getByText('Can we come on Thursday?')).toBeVisible()
  } finally {
    await tidy([orgId], [family, leader])
  }
})

test('WN13 a signed-out visitor is sent to sign in and returns to the message page, and a leader is sent to the inbox', async ({ page }) => {
  const orgId = await publicOrg(uniqueTitle('Northbank Therapy'))
  const leader = await named('Rachel Leader')
  await makeLeader(leader.id, undefined, orgId)
  try {
    await page.goto(`/organizations/${orgId}/message`)
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Forganizations%2F${orgId}%2Fmessage$`))

    await signIn(page, leader.email, leader.password)
    await page.goto(`/organizations/${orgId}/message`)
    await expect(page).toHaveURL(/\/dashboard\/organisation\/messages$/)
  } finally {
    await tidy([orgId], [leader])
  }
})
