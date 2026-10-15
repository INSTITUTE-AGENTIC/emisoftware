import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { razorpayClient } from '@/lib/razorpay-client'

/**
 * Creates (or returns the existing) Razorpay Payment Link for one EMI
 * installment, so the shopkeeper can send it to the customer over
 * WhatsApp/SMS. Tags `reference_id` and `notes` with device_id +
 * installment_no so the webhook can match the payment back without
 * guessing — see src/app/api/razorpay/webhook/route.ts.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string; installmentNo: string } }
) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const installmentNo = Number(params.installmentNo)

  const { data: installment, error: installmentError } = await session
    .from('emi_schedule')
    .select('*, devices(customer_name, customer_phone)')
    .eq('device_id', params.id)
    .eq('installment_no', installmentNo)
    .single()

  if (installmentError || !installment) {
    return NextResponse.json({ error: 'Installment not found or not accessible' }, { status: 404 })
  }

  if (installment.status === 'paid') {
    return NextResponse.json({ error: 'This installment is already paid' }, { status: 409 })
  }

  // Reuse an existing link instead of minting a new one on every click.
  if (installment.razorpay_payment_link_url) {
    return NextResponse.json({ url: installment.razorpay_payment_link_url })
  }

  const razorpay = razorpayClient()
  const customer = installment.devices as unknown as { customer_name: string; customer_phone: string }

  const link = await razorpay.paymentLink.create({
    amount: Math.round(Number(installment.amount) * 100), // paise
    currency: 'INR',
    accept_partial: false,
    description: `EMI installment ${installmentNo} for ${customer.customer_name}`,
    customer: {
      name: customer.customer_name,
      contact: customer.customer_phone,
    },
    notify: { sms: true, email: false },
    reference_id: `${params.id}:${installmentNo}`,
    notes: {
      device_id: params.id,
      installment_no: String(installmentNo),
    },
  } as never)

  const { error: updateError } = await session
    .from('emi_schedule')
    .update({
      razorpay_payment_link_id: link.id,
      razorpay_payment_link_url: link.short_url,
      payment_link_created_at: new Date().toISOString(),
    })
    .eq('device_id', params.id)
    .eq('installment_no', installmentNo)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ url: link.short_url })
}
