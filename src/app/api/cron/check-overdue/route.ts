import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendDeviceCommand } from '@/lib/fcm'

/**
 * Scheduled via vercel.json ("crons"). Vercel sets the Authorization
 * header to `Bearer ${CRON_SECRET}` on its own cron invocations — this
 * check keeps the endpoint from being triggered by anyone who finds the URL.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const graceDays = Number(process.env.EMI_GRACE_PERIOD_DAYS ?? '3')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - graceDays)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  // Installments past due_date + grace period that are still unpaid.
  const { data: overdue, error } = await db
    .from('emi_schedule')
    .select('device_id, installment_no, due_date, status')
    .lt('due_date', cutoffDate)
    .neq('status', 'paid')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deviceIds = [...new Set((overdue ?? []).map((r) => r.device_id))]
  let locked = 0

  for (const deviceId of deviceIds) {
    const { data: device } = await db.from('devices').select('*').eq('id', deviceId).single()
    if (!device || device.status !== 'active' || !device.fcm_token) continue

    await sendDeviceCommand(device.fcm_token, 'lock', { reason: 'emi_overdue' })
    await db.from('device_commands').insert({
      device_id: deviceId,
      command: 'lock',
      reason: 'emi_overdue',
    })
    await db.from('devices').update({ status: 'locked' }).eq('id', deviceId)

    // mark the overdue installments as such (if not already)
    await db
      .from('emi_schedule')
      .update({ status: 'overdue' })
      .eq('device_id', deviceId)
      .lt('due_date', cutoffDate)
      .eq('status', 'pending')

    locked++
  }

  return NextResponse.json({ checked: deviceIds.length, locked })
}
