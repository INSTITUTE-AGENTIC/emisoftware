import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendDeviceCommand } from '@/lib/fcm'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'

/**
 * Razorpay webhook — configure this URL in the Razorpay dashboard for
 * the `payment.captured` and `payment.failed` events.
 *
 * Expected flow: when you create the payment link/order for an
 * installment, you pass `notes.device_id` and `notes.installment_no`
 * so this handler can match the payment back to the right row without
 * guessing.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const db = supabaseAdmin()

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity
    const deviceId = payment.notes?.device_id
    const installmentNo = payment.notes?.installment_no

    if (!deviceId || !installmentNo) {
      // Payment wasn't tagged with our notes — log and bail rather than guess.
      return NextResponse.json({ error: 'Missing device_id/installment_no in payment notes' }, { status: 400 })
    }

    await db
      .from('emi_schedule')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
      })
      .eq('device_id', deviceId)
      .eq('installment_no', installmentNo)

    const { data: device } = await db.from('devices').select('*').eq('id', deviceId).single()

    if (device) {
      // If this installment had locked the device, unlock it now.
      if (device.status === 'locked' && device.fcm_token) {
        await sendDeviceCommand(device.fcm_token, 'unlock', { reason: 'emi_paid' })
        await db.from('device_commands').insert({
          device_id: deviceId,
          command: 'unlock',
          reason: 'emi_paid',
        })
        await db.from('devices').update({ status: 'active' }).eq('id', deviceId)
      }

      // Check if every installment is now paid -> trigger payoff teardown.
      const { data: remaining } = await db
        .from('emi_schedule')
        .select('id')
        .eq('device_id', deviceId)
        .neq('status', 'paid')

      if (remaining && remaining.length === 0 && device.fcm_token) {
        await sendDeviceCommand(device.fcm_token, 'deprovision', { reason: 'paid_off' })
        await db.from('device_commands').insert({
          device_id: deviceId,
          command: 'deprovision',
          reason: 'paid_off',
        })
        await db
          .from('devices')
          .update({ status: 'paid_off', deprovisioned_at: new Date().toISOString() })
          .eq('id', deviceId)
      }
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity
    const deviceId = payment.notes?.device_id
    const installmentNo = payment.notes?.installment_no

    if (deviceId && installmentNo) {
      await db
        .from('emi_schedule')
        .update({ status: 'overdue' })
        .eq('device_id', deviceId)
        .eq('installment_no', installmentNo)
      // Actual locking is left to the overdue-check cron, which respects
      // the configured grace period instead of locking on first failure.
    }
  }

  return NextResponse.json({ received: true })
}
