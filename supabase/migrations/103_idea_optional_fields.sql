-- 103 — only Title and Summary are required on an idea (idea-required-fields).
--
-- The board's form asks for a title, a summary and an optional "Why it
-- matters" (description). intended_use and primary_user leave both forms and
-- stay as a nullable fallback on the ideas that already carry them. The API's
-- readIdeaBody stores a blank optional field as null, never ''.
--
-- DOWN:
--   update public.toy_ideas set description = coalesce(description, ''),
--     intended_use = coalesce(intended_use, ''), primary_user = coalesce(primary_user, '');
--   alter table public.toy_ideas alter column description set not null,
--     alter column intended_use set not null, alter column primary_user set not null;

alter table public.toy_ideas
  alter column description drop not null,
  alter column intended_use drop not null,
  alter column primary_user drop not null;
