import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendDeviceCommand, type DeviceCommand } from '@/lib/fcm'

const ALLOWED: DeviceCommand[] = ['lock', 'unlock', 'wipe']

/**
 * Manual override from the admin panel (e.g. support team unlocks a
 * device after a customer pays in cash, or locks one reported stolen).
 * Requires a logged-in session — RLS-scoped reads confirm the caller
 * is allowed to see this device before any command goes out.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { command } = await request.json()
  if (!ALLOWED.includes(command)) {
    return NextResponse.json({ error: `command must be one of ${ALLOWED.join(', ')}` }, { status: 400 })
  }

  // RLS-scoped client confirms this user can actually see the device
  // (owner, or the distributor/shopkeeper chain it belongs to).
  const { data: device, error: deviceError } = await session
    .from('devices')
    .select('id, fcm_token, status')
    .eq('id', params.id)
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: 'Device not found or not accessible' }, { status: 404 })
  }

  if (!device.fcm_token) {
    return NextResponse.json({ error: 'Device has no registered push token yet' }, { status: 409 })
  }

  await sendDeviceCommand(device.fcm_token, command, { reason: 'manual_admin' })

  const db = supabaseAdmin()
  await db.from('device_commands').insert({
    device_id: params.id,
    command,
    reason: 'manual_admin',
    issued_by: user.id,
  })

  if (command === 'lock' || command === 'unlock') {
    await db.from('devices').update({ status: command === 'lock' ? 'locked' : 'active' }).eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
