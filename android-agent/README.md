# EMI Protect — Android device agent

The on-device half of the EMI lock platform. Provisioned as **Device
Owner** on a financed phone before handover, it enforces the lock
screen when an installment is overdue, reports approximate location +
status on a ~4-hour cycle, and removes itself automatically once the
device is fully paid off.

CI (`.github/workflows/android-ci.yml` at the repo root) assembles a
debug build and runs lint on every push that touches this folder — that
GitHub Actions runner has normal internet access to `dl.google.com`,
which the sandbox this was written in does **not** (outbound to that
host is blocked by its network policy), so this is the first point
where the project actually gets a verified build rather than a
by-hand read-through. Check that workflow's run after pushing.

## What a factory reset can and can't do to this app

This matters more than almost anything else here — a reset that erases
the lock app erases the whole business model. Read this before telling
the client what's protected.

**Blocked completely — reset from within Settings ("Erase all data" /
"Factory data reset" in the Settings app):** `MyDeviceAdminReceiver`
sets `UserManager.DISALLOW_FACTORY_RESET` as a Device Owner restriction
at provisioning time. The option disappears from Settings entirely.
Also blocked the same way: Safe Mode boot (a route to temporarily
disable this app's receivers while leaving the OS intact), USB
debugging, and removing the Google account that FRP depends on.
`setUninstallBlocked` additionally stops the app being uninstalled
through the OS.

**NOT blocked — a hardware recovery-mode wipe** (holding
Volume+Power into the bootloader/recovery menu and choosing "wipe data
/ factory reset" there, or `fastboot -w`/`fastboot erase userdata` from
a PC with USB debugging... which is itself blocked above, but a locked
bootloader's stock recovery menu doesn't need debugging enabled at
all). That wipes the data partition — every app including this one —
before Android and its Device Owner policies are even running. **No
app can prevent this.** It is not a bug in this implementation; it is
true of every MDM and every commercial EMI-lock product (Chimera,
MobiLock, etc.) on the market, because it happens below the OS layer
that any of them run in.

What actually limits this attack in practice, in order of how much
they help:

1. **A locked bootloader** (the default on virtually every phone sold
   in India) makes `fastboot -w` refuse to run without first enabling
   OEM unlocking from Developer Options — which `DISALLOW_DEBUGGING_FEATURES`
   above blocks access to on most OEM skins. The stock recovery-menu wipe
   (no bootloader unlock needed) still works regardless; this only
   closes the `fastboot` variant of the attack.
2. **Factory Reset Protection (FRP)** — built into Android automatically
   whenever a Google account is signed in. After *any* reset (recovery
   or Settings), the device demands sign-in with a Google account that
   was previously on it before setup can complete. It doesn't bring the
   app back, but it makes the reset phone useless to a casual reseller.
   FRP bypass tools exist and work on some OEM/Android-version
   combinations, more often on older/budget phones — don't oversell this
   as unbeatable either.
3. **IMEI blacklisting (CEIR)** — the real backstop once a device is
   confirmed gone. The admin panel's device page has a "Flag for IMEI
   block" action (`flagged_stolen` on the `devices` table) — it only
   records the flag; actually submitting the IMEI happens manually at
   `ceir.sancharsaathi.gov.in`. Once blacklisted, the phone can't
   register on any Indian telecom network, reset or not. This is the
   step that actually recovers the loss, not an app feature — make it
   part of the shopkeeper/distributor process for any device that goes
   dark after a reset.

Tell the client this plainly: the lock deters casual non-payment and
makes a reset the clear signal that a device has gone bad, but the
money-recovery step for a determined thief is CEIR reporting, not the
app. Anyone pitching 100% reset-proof software is overselling it.

## What's here

```
android-agent/
├── app/
│   ├── build.gradle.kts          # dependencies, buildConfigField for API_BASE_URL/DEVICE_API_KEY
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/com/emisoftware/agent/
│           ├── MainActivity.kt          # home screen — shown when in good standing
│           ├── lock/LockActivity.kt     # full-screen kiosk lock — shown when overdue
│           ├── admin/MyDeviceAdminReceiver.kt  # Device Owner provisioning hook
│           ├── fcm/AgentFirebaseMessagingService.kt  # lock/unlock/wipe/deprovision commands
│           ├── boot/BootCompletedReceiver.kt    # re-locks across reboot
│           ├── work/LocationCheckinWorker.kt    # periodic location + FCM token report
│           ├── data/DeviceConfig.kt     # local storage of this device's backend ID
│           └── network/ApiClient.kt     # talks to the Next.js backend
└── build.gradle.kts / settings.gradle.kts / gradle/
```

## Building

Needs Android Studio (easiest) or a local Android SDK with `ANDROID_HOME`
set and a `local.properties` file (`sdk.dir=/path/to/sdk`, git-ignored).

```
./gradlew :app:assembleDebug -PapiBaseUrl=https://emisoftware.vercel.app -PdeviceApiKey=<DEVICE_AGENT_API_KEY from the backend .env>
```

`apiBaseUrl` / `deviceApiKey` bake into `BuildConfig` (see
`app/build.gradle.kts`) — the same value as the backend's
`DEVICE_AGENT_API_KEY` env var. One shared key for every device for now;
see "Still to build" below on why that should change before real volume.

### Firebase (required for push commands to work)

1. Create a Firebase project, add an Android app with package name
   `com.emisoftware.agent`.
2. Download `google-services.json`, drop it in `android-agent/app/`
   (it's git-ignored — never commit it).
3. Put that project's **service account** JSON into the backend's
   `FIREBASE_SERVICE_ACCOUNT_JSON` env var (Project Settings → Service
   Accounts → Generate new private key) — that's what `src/lib/fcm.ts`
   on the backend uses to send commands to this app.

Without `google-services.json`, the app still builds (the Google
Services Gradle plugin only applies when the file is present — see the
`hasGoogleServices` check at the top of `app/build.gradle.kts`) but FCM
push won't work, so lock/unlock/wipe/deprovision commands never arrive.

## Provisioning a phone (the actual EMI-lock step)

Device Owner provisioning has to happen **before** the customer's
Google account is added — on the factory-reset "Welcome" screen, via
QR code. Generate one per device (or reuse one QR for the APK + wire
the specific `device_id` in afterward — see note below) with a payload
like:

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.emisoftware.agent/.admin.MyDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "<HTTPS URL to the signed APK>",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION_SIGNATURE_CHECKSUM": "<base64 SHA-256 of the APK's signing cert>",
  "android.app.extra.PROVISIONING_WIFI_SSID": "<shop wifi, optional>",
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "device_id": "<the UUID from POST /api/devices>"
  }
}
```

That `device_id` in the extras bundle is read in
`MyDeviceAdminReceiver.onProfileProvisioningComplete` and stored
locally — it's how the app knows which backend row is "itself" with
zero manual setup on the phone. In practice: finance the device first
(creates the `device_id`), generate that device's QR code, then
provision. A small internal tool to turn `{apk_url, checksum,
device_id}` into a QR image (any `zxing`/`qrcode` library, a few lines)
is the missing piece — not built yet, see below.

## Still to build

- **QR code generator** for the provisioning payload above (take
  `device_id`, emit a PNG) — shopkeeper-facing, so it belongs in the
  admin panel's device page once a device is created.
- **Per-device API keys** instead of one shared `DEVICE_AGENT_API_KEY`
  — fine for a pilot, not for scale; one leaked key currently exposes
  the location/check-in endpoint for every device at once.
- **APK signing + hosting** for the `PACKAGE_DOWNLOAD_LOCATION` URL —
  needs a signed release build uploaded somewhere HTTPS-reachable
  (Vercel Blob, S3, etc.) plus its signing cert's SHA-256 checksum.
- **Actual device testing** — this was built and reviewed by hand in a
  sandboxed environment with no Android SDK and no network path to
  `dl.google.com`, so it has never been compiled or run. The GitHub
  Actions workflow is the first real compile check; a physical or
  emulator test provisioning a device owner is the only way to confirm
  the lock/unlock/wipe flow actually behaves as designed, and that
  still needs to happen before this goes anywhere near a real customer
  phone.
