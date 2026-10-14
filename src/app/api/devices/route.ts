import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET: list devices visible to the signed-in user (RLS scopes this
 * automatically to "all" for owner, or just their own chain for a
 * distributor/shopkeeper).
 *
 * POST: register a newly financed device and generate its EMI
 * schedule. Called by the shopkeeper's flow at point of sale, after
 * the customer has signed the financing + device-lock consent form
 * and the agent app has been provisioned on the phone.
 */
export async function GET() {
  const session = supabaseServer()
  const { data, error } = await session
    .from('devices')
    .select('id, imei, model, customer_name, status, emi_amount, emi_count, start_date, last_lat, last_lng, last_location_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ devices: data })
}

export async function POST(request: Request) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  const {
    shopkeeper_id,
    imei,
    model,
    customer_name,
    customer_phone,
    consent_document_url,
    purchase_price,
    down_payment,
    emi_count,
    start_date,
  } = body

  if (!shopkeeper_id || !imei || !customer_name || !customer_phone || !purchase_price || !emi_count) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!consent_document_url) {
    // Lock/location features are only legitimate when disclosed and signed.
    // The UI should block submission without it; this is the server-side backstop.
    return NextResponse.json({ error: 'consent_document_url is required before a device can be financed' }, { status: 400 })
  }

  const principal = Number(purchase_price) - Number(down_payment ?? 0)
  const emiAmount = Math.ceil((principal / Number(emi_count)) * 100) / 100

  const { data: device, error: deviceError } = await session
    .from('devices')
    .insert({
      shopkeeper_id,
      imei,
      model,
      customer_name,
      customer_phone,
      consent_document_url,
      consent_signed_at: new Date().toISOString(),
      purchase_price,
      down_payment: down_payment ?? 0,
      emi_amount: emiAmount,
      emi_count,
      start_date: start_date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: deviceError?.message ?? 'Failed to create device' }, { status: 500 })
  }

  const schedule = Array.from({ length: Number(emi_count) }).map((_, i) => {
    const due = new Date(device.start_date)
    due.setMonth(due.getMonth() + i + 1)
    return {
      device_id: device.id,
      installment_no: i + 1,
      due_date: due.toISOString().slice(0, 10),
      amount: emiAmount,
    }
  })

  const { error: scheduleError } = await session.from('emi_schedule').insert(schedule)
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message }, { status: 500 })
  }

  return NextResponse.json({ device }, { status: 201 })
}
