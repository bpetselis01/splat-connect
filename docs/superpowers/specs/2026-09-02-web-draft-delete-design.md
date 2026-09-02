# Web: a contributor can delete their own draft

**Date:** 2026-09-02
**Status:** Design, awaiting review. Not committed.
**Touches:** `app/tutorials/[id]/edit/page.tsx`, one existing component
(`components/delete-entity-button.tsx`, unchanged), the web unit suite, one
e2e spec.

**Depends on** `2026-09-02-mobile-guide-authoring-design.md`, which fixes
`DELETE /api/tutorials/:id` to answer 409 instead of a false 204. This spec
assumes that fix has landed; it is what makes the error path below reachable.

## Why

The delete rule is already law and has been since the first migration.
`001_schema.sql:183` lets a contributor delete a tutorial they are on when its
`status = 'draft'`, and nothing else. Admins can delete any.

Every layer above the database disagrees with it, each in a different
direction. Mobile renders `Delete guide` on every status and reports success
when the policy silently refuses. The API returns 204 for a delete that removed
nothing. And web offers no way to delete a tutorial at all, at any status —
`DeleteEntityButton` exists and is polished, but only `child-editor.tsx` and
`toy-editor.tsx` use it.

The mobile spec fixes the first two. This one fixes the third, which is the
opposite failure: a contributor who starts a draft on web and abandons it has
no way to remove it. It sits in their dashboard forever. The database would
allow the delete; there is simply no button.

## Decisions taken

Byron's, 2026-09-02.

1. **Web gets the same draft-only delete mobile is getting**, so the two
   platforms finally agree with each other and with the policy.
2. **Separate from the mobile overhaul.** Same rule, different surface, its own
   review.

## The change

`app/tutorials/[id]/edit/page.tsx` renders, only when the tutorial's status is
`draft`:

```tsx
<DeleteEntityButton
  endpoint={`/api/tutorials/${id}`}
  redirectTo="/dashboard"
  label="draft"
/>
```

Nothing in `DeleteEntityButton` changes. It already does the whole job: a
native `<dialog>` with the platform's focus trap and Escape, a typed
confirmation phrase, a busy state, and an inline error. The phrase it derives
is `confirm_delete_draft`, which reads correctly for what is being destroyed.

Placement follows `toy-editor.tsx`, which renders it in the step row rather
than floating in the page body — the toy editor is the closest existing
analogue and already solved where this control belongs on a long edit page.

**Rendered, not disabled.** On a pending, approved or rejected tutorial the
button is absent. A disabled delete invites the question of how to enable it,
and the answer — "you cannot, once it has been submitted" — is better carried
by the control not being there. This matches decision 3 of the mobile spec, so
the two platforms are consistent in the same way.

## Error handling

With the API fix in place, a delete that the policy refuses comes back 409
rather than a false 204. `DeleteEntityButton` already surfaces a failed request
as an inline error in its dialog and stays open, so the failure is visible
without any change to the component.

That path should be unreachable through the UI, because the button is not
rendered off a draft. It is reachable by a status change landing between the
page render and the confirmation — a reviewer approving the draft while the
dialog is open — and the 409 is exactly right for that. It is worth stating
because it is the reason to depend on the API fix rather than ship this against
the current route: without it, that race ends in the dialog closing, a redirect
to the dashboard, and the tutorial still sitting there.

## Testing

Unit, in the edit page's existing test file `tests/unit/pages/edit-tutorial.test.tsx`:
the button renders for a draft, and does not render for
each of pending, approved and rejected. Four cases, one assertion each — the
whole rule is "which statuses show it".

`delete-entity-button.test.tsx` needs nothing. The component is unchanged and
already covered.

E2E, in web's auth-ed tutorial specs: a contributor creates a draft, deletes it
through the dialog, and it is gone from the dashboard. The 409 race is not
worth an e2e — it needs a reviewer approving mid-dialog, and the unit coverage
of "not rendered off a draft" plus the API integration test of "409 off a
draft" already pin both halves.

## Not in this spec

- Admin deletion. `is_admin()` may delete any tutorial and the admin area is
  its own surface; nothing here changes it.
- The API route itself. It is fixed in the mobile spec, and this one waits on it.
- Bulk or soft delete. The policy is a hard delete with cascades already
  declared on every child table (`001_schema.sql`), and nothing has asked for
  more.
