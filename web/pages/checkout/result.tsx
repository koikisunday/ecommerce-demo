import { useRouter } from 'next/router'

export default function CheckoutResult() {
  const router = useRouter()
  const { reference, status } = router.query

  const message =
    typeof status === 'string' && status.toUpperCase() === 'PAID'
      ? 'Payment processed. Check your orders page.'
      : typeof status === 'string' && status.toUpperCase() === 'PENDING'
        ? 'Payment is still pending. Refresh your orders page in a moment.'
        : 'We could not confirm payment yet. Please contact support if you were charged.'

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-white rounded shadow-md w-full max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Checkout Result</h2>
        <p>{message}</p>
        {typeof reference === 'string' && <p className="mt-2 text-sm text-gray-500">Reference: {reference}</p>}
        <div className="mt-4">
          <a href="/orders" className="text-indigo-600">View your orders</a>
        </div>
      </div>
    </div>
  )
}
