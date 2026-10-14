import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const session = supabaseServer()
  const { data, error } = await session.from('shopkeepers').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shopkeepers: data })
}

export async function POST(request: Request) {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { distributor_id, shop_name, owner_name, phone, city } = await request.json()
  if (!distributor_id || !shop_name) {
    return NextResponse.json({ error: 'distributor_id and shop_name are required' }, { status: 400 })
  }

  const { data, error } = await session
    .from('shopkeepers')
    .insert({ distributor_id, shop_name, owner_name, phone, city })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shopkeeper: data }, { status: 201 })
}
