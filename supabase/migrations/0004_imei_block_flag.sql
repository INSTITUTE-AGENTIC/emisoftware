-- Tracks devices that need manual IMEI blacklisting (CEIR) — the backstop
-- for a hardware recovery-mode wipe, which no Device Owner policy can
-- prevent (see android-agent/README.md).
alter table devices
  add column if not exists flagged_stolen boolean not null default false,
  add column if not exists flagged_stolen_at timestamptz,
  add column if not exists flagged_stolen_by uuid references profiles(id);
