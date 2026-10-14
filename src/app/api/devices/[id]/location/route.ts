import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Called by the Android agent app periodically (e.g. every few hours,
 * or on each boot / connectivity change) to report its location and
 * refresh its FCM token. Authenticated with a shared API key rather
 * than a user session, since there's no human logged in on the device.
 *
 * This endpoint — and the location data it collects — must match
 * exactly what the signed financing/consent agreement discloses to
 * the customer. Don't widen what's collected here without updating
 * that agreement first.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const apiKey = request.headers.get('x-device-api-key')
  if (apiKey !== process.env.DEVICE_AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lat, lng, fcm_token } = await request.json()

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng must be numbers' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const update: Record<string, unknown> = {
    last_lat: lat,
    last_lng: lng,
    last_location_at: new Date().toISOString(),
  }
  if (typeof fcm_token === 'string' && fcm_token.length > 0) {
    update.fcm_token = fcm_token
  }

  const { error } = await db.from('devices').update(update).eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
