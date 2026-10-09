# Per-guide counts are computed fields, not counter columns

Thanks, has-STL and any future per-Guide count are PostgREST computed fields (`create function public.x(t public.tutorials)`), never columns on `tutorials`. A counter column trips the `updated_at` trigger, so a thank would make an author's editor save fail with "updated by someone else". Computed fields must be `security definer` with an index on the foreign key they read: as `security invoker` they ran RLS per row and hit the 3 s anon timeout at 437 guides, which the small hosted project never shows.
