-- 135: maturity is gone. It decided which guides the public library listed
-- (only 'complete'), and Byron judged the field unnecessary: a guide is either
-- submitted for review or it is a draft. Dropping it makes every approved guide
-- listable; the rows that were hidden are counted in the PR description before
-- this is applied to the hosted database.
alter table tutorials drop column if exists maturity;
