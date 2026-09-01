-- primary_diagnosis was collected but never consumed: no matching or
-- recommendation logic reads it, it was only echoed back to the parent.
-- A diagnosis is sensitive health information under APP 3 (Privacy Act 1988
-- (Cth)); collecting it without a purpose is a privacy liability, and holding
-- it strengthens the case that Connect is presenting itself clinically
-- (Therapeutic Goods Act 1989 (Cth) intended-purpose test). Every field
-- deleted is a field that cannot be breached.
--
-- Destructive: take a database backup before running this in a live project.
alter table public.child_profiles drop column primary_diagnosis;
