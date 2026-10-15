import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Read-only status check the agent app itself calls (shared device API
 * key, no user session) to render its home screen and lock screen:
 * current status, next due installment, and the shop's contact info
 * for the "contact shop" button on the lock screen.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const apiKey = request.headers.get('x-device-api-key')
  if (apiKey !== process.env.DEVICE_AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: device, error } = await db
    .from('devices')
    .select('id, status, customer_name, emi_amount, emi_count, shopkeepers(shop_name, phone)')
    .eq('id', params.id)
    .single()

  if (error || !device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  const { data: nextDue } = await db
    .from('emi_schedule')
    .select('installment_no, due_date, amount, status, razorpay_payment_link_url')
    .eq('device_id', params.id)
    .neq('status', 'paid')
    .order('installment_no')
    .limit(1)
    .maybeSingle()

  const shopkeeper = device.shopkeepers as unknown as { shop_name: string; phone: string | null } | null

  return NextResponse.json({
    status: device.status,
    customer_name: device.customer_name,
    emi_amount: device.emi_amount,
    emi_count: device.emi_count,
    shop_name: shopkeeper?.shop_name ?? null,
    shop_phone: shopkeeper?.phone ?? null,
    next_installment: nextDue ?? null,
  })
}
