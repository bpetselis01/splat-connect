-- 136: no child's name is stored. child_profiles.name and toy_transactions.child_label
-- are no longer read or written by any code (spec 2026-10-09-remove-child-name-design).
-- A child is "Child N" by created_at order. Irreversible for the values: the down
-- direction can only recreate empty columns. Backup of both columns taken first in
-- ~/splat-connect-db-backups/pre-136-*. The child_label length check goes with its column.
alter table child_profiles drop column if exists name;
alter table toy_transactions drop column if exists child_label;
