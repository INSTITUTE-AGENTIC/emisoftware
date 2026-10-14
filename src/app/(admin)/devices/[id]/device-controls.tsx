'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeviceControls({ deviceId, status }: { deviceId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function send(command: 'lock' | 'unlock' | 'wipe') {
    if (command === 'wipe' && !confirm('This remotely wipes the device. Are you sure?')) return

    setLoading(command)
    const res = await fetch(`/api/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    setLoading(null)

    if (!res.ok) {
      const { error } = await res.json()
      alert(error ?? 'Command failed')
      return
    }
    router.refresh()
  }

  if (status === 'paid_off') {
    return <span className="text-sm text-slate-400">Fully paid — agent app removed</span>
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => send('unlock')}
        disabled={loading !== null}
        className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading === 'unlock' ? 'Sending…' : 'Unlock'}
      </button>
      <button
        onClick={() => send('lock')}
        disabled={loading !== null}
        className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading === 'lock' ? 'Sending…' : 'Lock'}
      </button>
      <button
        onClick={() => send('wipe')}
        disabled={loading !== null}
        className="rounded border border-red-600 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
      >
        {loading === 'wipe' ? 'Sending…' : 'Wipe'}
      </button>
    </div>
  )
}
