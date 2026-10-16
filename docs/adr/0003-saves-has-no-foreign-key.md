# Saves point at entities without a foreign key

`saves.entity_id` is polymorphic (Guide, Toy, Challenge, with Organisation and printable part reserved), so it carries no foreign key. A hard delete leaves an orphan row nobody reads, because the list is two queries: the save rows, then the entities through the user's client, so RLS drops anything the caller can no longer see. That is how a gifted Toy quietly leaves your saved list. We chose silent disappearance over a tombstone. `SAVE_SLUGS` is the single switch for which types are live.
