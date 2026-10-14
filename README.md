# EMI Lock Platform

Admin backend for a device-financing business: distributors add shopkeepers,
shopkeepers register devices sold on EMI, payments are collected via
Razorpay, and devices that fall behind on payment are remotely locked until
caught up — unlocked automatically on payment, fully released on payoff.

**This only works as designed when the end customer has signed a financing
agreement that discloses device-locking and location tracking up front.**
Every endpoint here assumes that consent already exists (see
`consent_document_url` on the `devices` table) — it's the thing that keeps
this a legitimate financing tool instead of spyware.

## Stack

- Next.js 14 (App Router) + TypeScript, deployed on Vercel
- Supabase (Postgres + Auth + RLS) for data
- Razorpay for EMI collection
- Firebase Cloud Messaging to push lock/unlock/wipe/deprovision commands to
  the Android agent app (see `android-agent/README.md` for that app's design —
  it's a separate Android Studio project, not part of this repo yet)

## Getting started

1. Create a Supabase project, run `supabase/migrations/0001_init.sql` in the
   SQL editor.
2. Copy `.env.example` to `.env.local` and fill in Supabase, Razorpay, Firebase
   and cron secret values.
3. Create your first `owner`-role user in Supabase Auth, then insert a
   matching row into `profiles` with `role = 'owner'`.
4. `npm install && npm run dev`

## Data flow

```
Shopkeeper sells phone on EMI
        │
        ▼
POST /api/devices  → creates device + generates emi_schedule
        │
        ▼
Customer pays installment via Razorpay
        │
        ▼
POST /api/razorpay/webhook (payment.captured)
  → marks installment paid
  → unlocks device if it was locked
  → if all installments paid → sends "deprovision" → agent app removes itself
        │
        ▼
Cron (/api/cron/check-overdue, every 6h via vercel.json)
  → finds installments past due_date + grace period, still unpaid
  → sends "lock" command via FCM
```

## Manual overrides

Admin panel → device detail page → Lock / Unlock / Wipe buttons, calling
`POST /api/devices/{id}/command`. Requires a signed-in session; RLS confirms
the caller can actually see that device before any command is sent.

## Still to build

- Admin UI forms for creating distributors/shopkeepers/devices (API routes
  exist; see `src/app/api/*`) and uploading the signed consent document
- Razorpay order/payment-link creation flow tagged with
  `notes.device_id` / `notes.installment_no` (required for the webhook to
  match payments back to installments)
- The actual Android agent app (`android-agent/README.md` has the architecture)
- Map view on the device detail page (lat/lng are already stored and returned)
