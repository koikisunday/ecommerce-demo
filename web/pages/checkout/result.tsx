import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function CheckoutResult() {
  const router = useRouter()
  const { reference } = router.query
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!reference) return
    ;(async () => {
      try {
        const res = await axios.get(`/api/paystack/verify?reference=${encodeURIComponent(reference as string)}`)
        // verify endpoint redirects; but we'll just set status as success
        setStatus('Payment processed. Check your orders page.')
      } catch (err) {
        setStatus('Verification failed. Please contact support.')
      }
    })()
  }, [reference])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-white rounded shadow-md w-full max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Checkout Result</h2>
        <p>{status ?? 'Verifying payment...'}</p>
        <div className="mt-4">
          <a href="/orders" className="text-indigo-600">View your orders</a>
        </div>
      </div>
    </div>
  )
}
