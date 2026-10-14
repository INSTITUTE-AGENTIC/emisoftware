import { supabaseServer } from '@/lib/supabase-server'

export default async function DashboardPage() {
  const session = supabaseServer()

  const [{ count: deviceCount }, { count: lockedCount }, { count: distributorCount }, { count: shopkeeperCount }] =
    await Promise.all([
      session.from('devices').select('*', { count: 'exact', head: true }),
      session.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'locked'),
      session.from('distributors').select('*', { count: 'exact', head: true }),
      session.from('shopkeepers').select('*', { count: 'exact', head: true }),
    ])

  const { data: overdueInstallments } = await session
    .from('emi_schedule')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'overdue')

  const cards = [
    { label: 'Total devices', value: deviceCount ?? 0 },
    { label: 'Currently locked', value: lockedCount ?? 0 },
    { label: 'Distributors', value: distributorCount ?? 0 },
    { label: 'Shopkeepers', value: shopkeeperCount ?? 0 },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Overdue installments awaiting payment or auto-lock: {overdueInstallments ?? 0}
      </p>
    </div>
  )
}
