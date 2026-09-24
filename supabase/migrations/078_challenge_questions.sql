-- 078 — a design challenge can be a question.
--
-- The board's /get-involved/design-challenges mixes two kinds of card: build
-- challenges ("4 makers") and questions ("Can holding a switch down for a
-- minute damage the toy?" — "Answered · 5 answers"), with a Questions filter.
-- A question is the same object — an idea a family posts, reviewed, then open,
-- with a thread — that is resolved by an answer instead of a guide. So it is a
-- kind on toy_ideas rather than a second table, and every existing screen,
-- policy and notification works for both.
--
--   toy_ideas.kind                 'challenge' (default, every existing row) or
--                                  'question'
--   toy_ideas.answer_message_id    the reply the author marked as the answer.
--                                  SET NULL if that message goes.
--   toy_ideas.answered_at          when they marked it
--
-- A question never graduates into a guide; the API refuses it, and this check
-- makes it true of the rows too.
--
-- DOWN:
--   alter table public.toy_ideas drop constraint if exists toy_ideas_question_not_graduated;
--   alter table public.toy_ideas drop column if exists answered_at,
--     drop column if exists answer_message_id, drop column if exists kind;

alter table public.toy_ideas
  add column kind text not null default 'challenge' check (kind in ('challenge', 'question')),
  add column answer_message_id uuid references public.toy_idea_messages (id) on delete set null,
  add column answered_at timestamptz;

alter table public.toy_ideas
  add constraint toy_ideas_question_not_graduated check (kind = 'challenge' or status <> 'graduated');
