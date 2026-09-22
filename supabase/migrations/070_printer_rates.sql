-- 070 — a printer's standard rates, for the board's "Pickup and cost" card.
--
--   printers.filament_cents_per_g  what a family is asked to cover, per gram of
--                                  filament. Integer cents for the reason 042
--                                  gives about cost lines: never a float. NULL
--                                  is the toggle's off state — the printer is
--                                  free, parts only — so a zero is "I charge
--                                  nothing and said so" and a NULL is "I never
--                                  set one", and the card can draw them apart.
--   printers.rate_note             the "why these costs" a requester reads
--                                  word for word before they ask. Same 500-char
--                                  rule as `notes`.
--
-- Nothing here moves money. SPLAT keeps a written record both sides can see
-- and they settle it between themselves, exactly as 042's cost lines do.
--
-- DOWN:
--   alter table public.printers drop column if exists rate_note;
--   alter table public.printers drop column if exists filament_cents_per_g;

alter table public.printers
  add column filament_cents_per_g int check (filament_cents_per_g >= 0),
  add column rate_note text check (rate_note is null or length(btrim(rate_note)) <= 500);
