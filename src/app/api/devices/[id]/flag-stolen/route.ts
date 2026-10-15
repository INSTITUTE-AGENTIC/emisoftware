import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Marks a device as defaulted/stolen beyond recovery — the trigger for
 * manually reporting its IMEI to India's CEIR (ceir.sancharsaathi.gov.in)
 * so the device is blacklisted network-wide. This endpoint only records
 * the flag; it does NOT call any telecom API (there isn't a self-serve
 * one for individual financiers) — submitting the actual report is a
 * manual step on that portal using the IMEI shown on the device page.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { error } = await session
    .from('devices')
    .update({
      flagged_stolen: true,
      flagged_stolen_at: new Date().toISOString(),
      flagged_stolen_by: user.id,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
