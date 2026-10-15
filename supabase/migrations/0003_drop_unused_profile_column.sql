-- profiles.distributor_id was never read by any RLS policy (they join
-- through distributors.profile_id / shopkeepers.profile_id instead) —
-- dropping it so the schema doesn't imply a relationship that isn't there.
alter table profiles drop column if exists distributor_id;
