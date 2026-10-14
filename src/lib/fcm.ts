import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function app() {
  if (getApps().length) return getApps()[0]

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured')
  }

  return initializeApp({ credential: cert(JSON.parse(raw)) })
}

export type DeviceCommand = 'lock' | 'unlock' | 'wipe' | 'deprovision'

/**
 * Sends a data-only push to the device agent app. The agent (running
 * as Device Owner) listens for these in a foreground/background FCM
 * service and calls the matching DevicePolicyManager API — it does
 * not display a notification, so the user never has to tap anything.
 */
export async function sendDeviceCommand(fcmToken: string, command: DeviceCommand, extra: Record<string, string> = {}) {
  const messaging = getMessaging(app())

  return messaging.send({
    token: fcmToken,
    data: { command, ...extra },
    android: { priority: 'high' },
  })
}
