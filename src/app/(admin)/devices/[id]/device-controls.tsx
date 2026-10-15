'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeviceControls({
  deviceId,
  status,
  imei,
  flaggedStolen,
}: {
  deviceId: string
  status: string
  imei: string
  flaggedStolen: boolean
}) {
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

  async function flagStolen() {
    if (
      !confirm(
        `Flag this device for IMEI blacklisting? This is for a device confirmed defaulted/stolen and unrecoverable (e.g. after a factory reset). You still need to manually submit IMEI ${imei} at ceir.sancharsaathi.gov.in — this just records the flag here.`
      )
    )
      return

    setLoading('flag')
    const res = await fetch(`/api/devices/${deviceId}/flag-stolen`, { method: 'POST' })
    setLoading(null)

    if (!res.ok) {
      const { error } = await res.json()
      alert(error ?? 'Failed to flag device')
      return
    }
    router.refresh()
  }

  const lockControls =
    status === 'paid_off' ? (
      <span className="text-sm text-slate-400">Fully paid — agent app removed</span>
    ) : (
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

  return (
    <div className="flex flex-col items-end gap-2">
      {lockControls}
      {flaggedStolen ? (
        <span className="text-xs font-medium text-red-700">
          ⚠ Flagged for IMEI block — confirm it was submitted at ceir.sancharsaathi.gov.in
        </span>
      ) : (
        <button
          onClick={flagStolen}
          disabled={loading !== null}
          className="text-xs text-slate-400 underline hover:text-red-600 disabled:opacity-50"
        >
          {loading === 'flag' ? 'Flagging…' : "Device unrecoverable? Flag for IMEI block"}
        </button>
      )}
    </div>
  )
}
