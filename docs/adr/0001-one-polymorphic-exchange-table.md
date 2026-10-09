# One table for every Exchange, with extra steps as timestamps

Gifts, Swaps, Builds and Prints all live in `toy_transactions`, with a per-type CASE constraint holding each shape (`toy_id` is nullable). A second table would have forked the thread, accept step, handover codes, cost panel, RLS and notifications. Extra steps are timestamp columns, never new `status` members: adding `printing` to the status check would silently stop every `status = 'accepted'` predicate in the API from matching a live record. Anything reading `toy_id` must guard on the Exchange kind.
