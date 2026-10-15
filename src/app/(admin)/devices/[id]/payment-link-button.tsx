'use client'

import { useState } from 'react'

export default function PaymentLinkButton({
  deviceId,
  installmentNo,
  customerPhone,
  existingUrl,
}: {
  deviceId: string
  installmentNo: number
  customerPhone: string
  existingUrl: string | null
}) {
  const [url, setUrl] = useState(existingUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createLink() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/devices/${deviceId}/emi/${installmentNo}/payment-link`, { method: 'POST' })
    setLoading(false)

    if (!res.ok) {
      const { error } = await res.json()
      setError(error ?? 'Failed to create payment link')
      return
    }
    const { url: newUrl } = await res.json()
    setUrl(newUrl)
  }

  if (url) {
    const digits = customerPhone.replace(/\D/g, '')
    const waText = encodeURIComponent(`Your EMI installment ${installmentNo} payment link: ${url}`)
    return (
      <a
        href={`https://wa.me/${digits}?text=${waText}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-medium text-green-700 hover:underline"
      >
        Send via WhatsApp
      </a>
    )
  }

  return (
    <div>
      <button onClick={createLink} disabled={loading} className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50">
        {loading ? 'Creating…' : 'Create payment link'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
