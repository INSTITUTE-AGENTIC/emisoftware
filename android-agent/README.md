# Android device agent — architecture notes

This folder is a placeholder for the actual Android Studio project. Scope and
build it as a separate module from the admin panel. Key pieces:

## 1. Device Owner provisioning (not a hidden install)

Provision the agent as **Device Owner** via Android's standard enterprise
QR-code flow, done on the factory-reset "Welcome" screen *before* the
customer's Google account is added:

- Build a provisioning QR payload with `PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME`
  pointing at your `DeviceAdminReceiver` subclass, plus the APK download URL
  and its checksum.
- On first boot, Android installs the agent and grants it Device Owner
  status automatically — no manual "enable admin" toggle the customer could
  forget or refuse later.
- This is the same mechanism enterprise MDM (Intune, Workspace ONE) uses. It
  only works pre-setup; it cannot be bolted on silently after the customer is
  already using the phone, which is why provisioning has to happen at the
  shop, before handover, with the signed consent form already in hand.

Reference: `DevicePolicyManager.ACTION_PROVISION_MANAGED_DEVICE`.

## 2. Core capabilities needed

| Capability | API |
|---|---|
| Full-screen lock override | `LockTask` (kiosk) mode showing a "Payment overdue — contact [shop]" screen with the shopkeeper's phone number, nothing else reachable |
| Block factory reset / uninstall | Device Owner apps can disable `DISALLOW_FACTORY_RESET` and are themselves protected from uninstall while Device Owner |
| Remote wipe | `DevicePolicyManager.wipeData()` — only ever call this for a confirmed stolen/defaulted device after other recovery steps fail, not as a first response to a missed payment |
| Silent self-removal on payoff | `DevicePolicyManager.clearDeviceOwnerApp()` after the "deprovision" command, so the customer gets their normal phone back automatically |

## 3. Backend wiring

- **Push channel:** Firebase Cloud Messaging, data-only messages (see
  `src/lib/fcm.ts` in the Next.js app). A foreground `FirebaseMessagingService`
  receives `{command: "lock" | "unlock" | "wipe" | "deprovision"}` and calls
  the matching `DevicePolicyManager` method.
- **Check-in:** on boot, network change, and every few hours, POST to
  `/api/devices/{id}/location` with `{lat, lng, fcm_token}`, authenticated
  with the shared `DEVICE_AGENT_API_KEY` header `X-Device-Api-Key`.
- **Anti-tamper:** Device Owner status plus `setUninstallBlocked` stops the
  obvious bypass (uninstalling the app). It does not stop a determined
  attacker with `fastboot`/custom recovery — that's a hardware-level limit
  shared by every EMI-lock product on the market, not something to oversell
  to the client as unbeatable.

## 4. What NOT to build

- No hidden icon, no disguising the app as something else, no collecting
  anything beyond lock-state + location — that crosses from disclosed
  financing-security tooling into stalkerware, and will get the app pulled
  from Play (if distributed that way) and exposes your client legally.
- Keep the lock screen's contact-the-shop messaging prominent; never make it
  look like a generic "device error" to obscure why it's locked.
