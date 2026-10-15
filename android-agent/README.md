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
