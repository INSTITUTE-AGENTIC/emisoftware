import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase-server'

export default async function Home() {
  const session = supabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()

  redirect(user ? '/dashboard' : '/login')
}
