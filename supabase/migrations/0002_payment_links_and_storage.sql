-- Adds Razorpay Payment Link tracking to emi_schedule, and a private
-- storage bucket for signed consent documents.

alter table emi_schedule
  add column if not exists razorpay_payment_link_id text,
  add column if not exists razorpay_payment_link_url text,
  add column if not exists payment_link_created_at timestamptz;

-- Storage bucket for the signed financing/consent document per device.
-- Private: only authenticated admin-panel users can read/write, never public.
insert into storage.buckets (id, name, public)
values ('consent-documents', 'consent-documents', false)
on conflict (id) do nothing;

create policy "authenticated users can upload consent docs"
  on storage.objects for insert
  with check (bucket_id = 'consent-documents' and auth.role() = 'authenticated');

create policy "authenticated users can read consent docs"
  on storage.objects for select
  using (bucket_id = 'consent-documents' and auth.role() = 'authenticated');
