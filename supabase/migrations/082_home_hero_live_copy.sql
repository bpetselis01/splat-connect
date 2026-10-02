-- 082 — the home hero row carries the hero the page draws now.
--
-- 065 seeded home-hero with "what app/page.tsx renders today", and the Soft Pop
-- home replaced that copy before anything read the row. The page now reads it,
-- so a row still holding 065's seed would put the old hero back on the site.
-- Only an untouched seed is rewritten: a row an admin has saved is theirs.
--
-- DOWN:
--   update public.site_content set value = <065's home-hero object>
--     where key = 'home-hero' and value = <the object below>;

update public.site_content
set value = jsonb_build_object(
  'eyebrow', 'Free to read, reviewed guides for switch-adapted play',
  'headline', 'Press it. Watch it go.',
  'subhead', 'We help families turn ordinary toys into ones that answer to one big switch — so every child gets the part that matters: making something happen.',
  'primary_label', 'Find a guide',
  'secondary_label', 'Borrow a toy'
),
updated_at = now()
where key = 'home-hero'
  and value = jsonb_build_object(
    'eyebrow', 'Free, reviewed, Australian',
    'headline', 'Every toy in the house was something he watched his sister play with.',
    'subhead', 'Guides for adapting shop toys so a child can play with one press of a switch. Written by parents, makers and therapists, reviewed before anyone reads them.',
    'primary_label', 'Browse the guides',
    'secondary_label', 'How it works'
  );
