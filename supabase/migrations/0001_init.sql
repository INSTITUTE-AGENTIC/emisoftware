-- EMI Lock Platform — initial schema
-- Run via the Supabase SQL editor or `supabase db push`.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Profiles: links a Supabase Auth user to a role in the hierarchy
-- role: 'owner' (your client, full access) | 'distributor' | 'shopkeeper'
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'distributor', 'shopkeeper')),
  full_name text,
  phone text,
  distributor_id uuid, -- set when role = 'shopkeeper' or 'distributor' itself
  created_at timestamptz not null default now()
);

create table if not exists distributors (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists shopkeepers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete set null,
  distributor_id uuid not null references distributors(id) on delete cascade,
  shop_name text not null,
  owner_name text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Devices: one row per financed phone
-- status: 'active' (within grace, unlocked) | 'locked' | 'paid_off'
-- ---------------------------------------------------------------------
create table if not exists devices (
  id uuid primary key default uuid_generate_v4(),
  shopkeeper_id uuid not null references shopkeepers(id) on delete cascade,
  imei text unique not null,
  model text,
  fcm_token text, -- updated by the Android agent on each check-in
  customer_name text not null,
  customer_phone text not null,
  -- proof the customer signed the device-lock / location-tracking disclosure
  consent_document_url text,
  consent_signed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'locked', 'paid_off')),
  purchase_price numeric(10, 2) not null,
  down_payment numeric(10, 2) not null default 0,
  emi_amount numeric(10, 2) not null,
  emi_count int not null,
  start_date date not null default current_date,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  provisioned_at timestamptz, -- when Device Owner provisioning completed
  deprovisioned_at timestamptz, -- when agent app was removed after payoff
  created_at timestamptz not null default now()
);

create index if not exists idx_devices_shopkeeper on devices(shopkeeper_id);
create index if not exists idx_devices_status on devices(status);

-- ---------------------------------------------------------------------
-- EMI schedule: one row per installment per device
-- ---------------------------------------------------------------------
create table if not exists emi_schedule (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid not null references devices(id) on delete cascade,
  installment_no int not null,
  due_date date not null,
  amount numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  razorpay_order_id text,
  razorpay_payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (device_id, installment_no)
);

create index if not exists idx_emi_device on emi_schedule(device_id);
create index if not exists idx_emi_due_status on emi_schedule(due_date, status);

-- ---------------------------------------------------------------------
-- Device commands: audit log of every lock/unlock/wipe/deprovision push
-- ---------------------------------------------------------------------
create table if not exists device_commands (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid not null references devices(id) on delete cascade,
  command text not null check (command in ('lock', 'unlock', 'wipe', 'deprovision')),
  reason text, -- e.g. 'emi_overdue', 'manual_admin', 'paid_off'
  issued_by uuid references profiles(id),
  issued_at timestamptz not null default now(),
  delivered boolean not null default false,
  delivered_at timestamptz
);

create index if not exists idx_commands_device on device_commands(device_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Server-side API routes use the service role key (bypasses RLS) for
-- writes driven by Razorpay webhooks, the Android agent, and the cron
-- job. These policies cover direct client reads from the admin panel
-- when using the user's own session.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table distributors enable row level security;
alter table shopkeepers enable row level security;
alter table devices enable row level security;
alter table emi_schedule enable row level security;
alter table device_commands enable row level security;

create policy "users read own profile" on profiles
  for select using (auth.uid() = id);

create policy "owner reads all distributors" on distributors
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner')
  );

create policy "distributor reads own row" on distributors
  for select using (profile_id = auth.uid());

create policy "owner and own distributor read shopkeepers" on shopkeepers
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner')
    or distributor_id in (select id from distributors where profile_id = auth.uid())
  );

create policy "scoped device reads" on devices
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner')
    or shopkeeper_id in (
      select s.id from shopkeepers s
      join distributors d on d.id = s.distributor_id
      where s.profile_id = auth.uid() or d.profile_id = auth.uid()
    )
  );

create policy "scoped emi reads" on emi_schedule
  for select using (
    device_id in (
      select id from devices -- relies on the devices policy above via RLS recursion
    )
  );

create policy "scoped command reads" on device_commands
  for select using (
    device_id in (select id from devices)
  );
