-- 063 — the drop-off declaration, recorded as what it is.
--
-- 059's `condition_declared` is a single boolean, which was right when the
-- booking form asked a single question. The artboard's /get-involved/recycling
-- asks seven, all required, and says why: "One contaminated bag can ruin a
-- whole extruder run."
--
-- Seven booleans would be seven columns that are always all true, because the
-- form cannot be submitted otherwise — the boolean stays. What is missing is
-- WHICH seven. A contributor who declares "no composites, nothing painted" in
-- September has not agreed to whatever the list says in March, and a dispute at
-- the door is exactly the moment somebody needs to know which wording was on
-- screen. That is the same problem user_agreements solves with a version
-- column, solved the same way.
--
-- The photo is the other half of the same argument. The artboard: "Sorted, in
-- the bag or box you will carry it in. It saves an argument at the door."
--
-- DOWN:
--   alter table public.recycling_dropoffs
--     drop column photo_url, drop column declaration_version;

alter table public.recycling_dropoffs
  -- A storage path in the private `recycling-photos` bucket, never a URL — the
  -- same rule 058's ready_photo_url follows.
  add column photo_url text,
  -- Which wording was ticked. Null on the rows 059 wrote, which predate the
  -- seven-line list and genuinely did agree to something else.
  add column declaration_version text
    check (declaration_version is null or length(btrim(declaration_version)) <= 40);

-- A declaration has to name the wording it agreed to, from here on. NOT VALID
-- for the rows written before the column existed: there is no version to
-- backfill them with, and inventing one would put words in somebody's mouth.
alter table public.recycling_dropoffs
  add constraint recycling_dropoffs_declaration_is_versioned
  check (condition_declared = false or declaration_version is not null)
  not valid;
