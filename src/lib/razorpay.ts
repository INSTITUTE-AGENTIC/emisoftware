import crypto from 'crypto'

/**
 * Verifies the X-Razorpay-Signature header on an incoming webhook.
 * Always check this before trusting webhook payload data — anyone
 * can POST to a public webhook URL, so the signature is the only
 * proof the request actually came from Razorpay.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  // timing-safe compare
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
