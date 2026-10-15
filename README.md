# EMI Lock Platform

Admin backend + Android device agent for a device-financing business:
distributors add shopkeepers, shopkeepers register devices sold on EMI,
payments are collected via Razorpay, and devices that fall behind on
payment are remotely locked until caught up — unlocked automatically on
payment, fully released on payoff.

**This only works as designed when the end customer has signed a financing
agreement that discloses device-locking and location tracking up front.**
Every endpoint here assumes that consent already exists (see
`consent_document_url` on the `devices` table) — it's the thing that keeps
this a legitimate financing tool instead of spyware.

## Stack

- Next.js 14 (App Router) + TypeScript, deployed on Vercel
- Supabase (Postgres + Auth + RLS + Storage) for data and the signed
  consent document
- Razorpay (Payment Links) for EMI collection
- Firebase Cloud Messaging to push lock/unlock/wipe/deprovision commands
- `android-agent/` — the Kotlin/Compose app that runs on each financed
  phone as Device Owner (separate Gradle project, see its own README)

## Getting started (backend)

1. Create a Supabase project, run the SQL files in `supabase/migrations/`
   **in order** in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in Supabase, Razorpay,
   Firebase and cron secret values.
3. Create your first `owner`-role user in Supabase Auth, then insert a
   matching row into `profiles` with `role = 'owner'`.
4. `npm install && npm run dev`

## Getting started (Android agent)

See `android-agent/README.md` — needs Android Studio or a local Android
SDK (this repo's own dev sandbox had no SDK and no network path to
`dl.google.com`, so the project is reviewed by hand but only actually
gradle-built by `.github/workflows/android-ci.yml` on push).

## Data flow

```
Shopkeeper sells phone on EMI (consent form signed first)
        │
        ▼
POST /api/devices  → creates device + generates emi_schedule
        │
        ▼
Admin panel "Create payment link" → Razorpay Payment Link, sent via WhatsApp
        │
        ▼
Customer pays → Razorpay webhook (payment.captured / payment_link.paid)
  → marks installment paid
  → unlocks device if it was locked
  → if all installments paid → sends "deprovision" → agent app removes itself
        │
        ▼
Cron (/api/cron/check-overdue, every 6h via vercel.json)
  → finds installments past due_date + grace period, still unpaid
  → sends "lock" command via FCM → phone shows the Lock screen
```

## Manual overrides

Admin panel → device detail page → Lock / Unlock / Wipe buttons, calling
`POST /api/devices/{id}/command`. Requires a signed-in session; RLS confirms
the caller can actually see that device before any command is sent.

## What's done

- Full schema + RLS, admin panel (dashboard, distributor/shopkeeper/device
  lists, create forms, device detail with lock controls + EMI schedule)
- Consent-document upload to private Supabase storage, required before a
  device record can be created
- Razorpay Payment Link creation per installment + WhatsApp send button
- Webhook reconciliation (mark paid → unlock → payoff teardown)
- Overdue-lock cron job
- Android agent app: Device Owner provisioning hook, FCM command receiver,
  kiosk-mode lock screen with pay/call-shop actions, periodic location
  check-in, boot-persistence, home screen showing live device status

## What's genuinely not done yet

- **QR provisioning-code generator** — the admin panel doesn't yet turn a
  newly financed device into the QR code a shopkeeper scans at setup
  (see `android-agent/README.md` for the payload shape it needs)
- **Per-device API keys** — the Android agent currently authenticates with
  one shared key for every device; fine for a pilot, needs fixing before
  real volume
- **Signed release APK hosting** — provisioning needs an HTTPS URL to the
  APK plus its signing cert checksum; no CI release build or hosting yet
- **The Android app has never run** — written and reviewed by hand with no
  Android SDK available in this dev session; `.github/workflows/android-ci.yml`
  gives the first real compile/lint check, but a physical device test of
  the actual lock/unlock flow hasn't happened
- **Owner bootstrap** is manual SQL (step 3 above) — no setup wizard
