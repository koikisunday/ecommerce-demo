import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import { clearCart } from '../../utils/cart'
import type { CartMismatch } from '../../utils/checkoutValidation'

type ResultStatus = 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN'

type CheckoutResultItem = {
  id: number
  quantity: number
  unitPrice: number
  productTitle: string
  productSku: string
}

type CheckoutResultOrder = {
  id: number
  customerEmail: string
  customerName: string | null
  totalAmount: number
  status: string
  paystackReference: string | null
  createdAt: string
  items: CheckoutResultItem[]
}

type CheckoutResultProps = {
  reference: string | null
  status: ResultStatus
  order: CheckoutResultOrder | null
}

function normalizeStatus(value: string | null | undefined): ResultStatus {
  if (!value) return 'UNKNOWN'
  const upper = value.toUpperCase()
  if (upper === 'PAID') return 'PAID'
  if (upper === 'PENDING') return 'PENDING'
  if (upper === 'FAILED') return 'FAILED'
  return 'UNKNOWN'
}

function getStatusMessage(status: ResultStatus): string {
  if (status === 'PAID') return 'Payment processed successfully.'
  if (status === 'PENDING') return 'Payment is still pending. Please check back shortly.'
  if (status === 'FAILED') return 'Payment failed to finalize. You can retry payment with refreshed inventory and pricing.'
  return 'We could not confirm payment yet. Please contact support if you were charged.'
}

export default function CheckoutResult({ reference, status, order }: CheckoutResultProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [retryMismatchMessages, setRetryMismatchMessages] = useState<string[]>([])
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'

  useEffect(() => {
    if (status !== 'PAID') return
    clearCart()
  }, [status])

  async function retryCheckout() {
    if (!reference) return
    setIsRetrying(true)
    setRetryError(null)
    setRetryMismatchMessages([])

    try {
      const res = await axios.post('/api/checkout/retry', { reference })
      window.location.href = res.data.authorization_url
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409 && Array.isArray(err.response.data?.mismatches)) {
          const mismatches = err.response.data.mismatches as CartMismatch[]
          setRetryError(err.response.data.error ?? 'Retry cart is out of date.')
          setRetryMismatchMessages(mismatches.map((mismatch) => mismatch.message))
          setIsRetrying(false)
          return
        }

        if (err.response?.status === 401) {
          window.location.href = '/auth/signin?callbackUrl=' + encodeURIComponent('/checkout/result?reference=' + reference + '&status=FAILED')
          return
        }
      }

      setRetryError('Could not start retry checkout right now.')
      setIsRetrying(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-2xl font-semibold">Checkout Result</h2>
        <p className="mt-2 text-gray-700">{getStatusMessage(status)}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">Status: {status}</span>
          {reference && <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">Reference: {reference}</span>}
        </div>

        {order && (
          <div className="mt-6 rounded border p-4">
            <h3 className="text-lg font-semibold">Order Summary</h3>
            <p className="mt-2 text-sm text-gray-600">Order #{order.id}</p>
            <p className="text-sm text-gray-600">Customer: {order.customerName ?? order.customerEmail}</p>
            <p className="text-sm text-gray-600">Email: {order.customerEmail}</p>
            <p className="text-sm text-gray-600">Placed: {new Date(order.createdAt).toLocaleString()}</p>

            <ul className="mt-4 space-y-2">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-medium">{item.productTitle}</p>
                    <p className="text-sm text-gray-600">SKU: {item.productSku || 'N/A'}</p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} x ${(item.unitPrice / 100).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-semibold">${((item.quantity * item.unitPrice) / 100).toFixed(2)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="font-medium text-gray-700">Total</span>
              <span className="text-xl font-bold">${(order.totalAmount / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {!order && (
          <p className="mt-6 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            Order summary is not available for this reference yet.
          </p>
        )}

        {status === 'FAILED' && reference && (
          <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">Recovery actions</h3>
            <p className="mt-2 text-sm text-amber-800">
              Retry payment to create a fresh order with current pricing and available stock.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={retryCheckout}
                disabled={isRetrying}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-amber-400"
              >
                {isRetrying ? 'Starting retry...' : 'Retry payment'}
              </button>
              <a className="rounded border border-amber-400 px-4 py-2 text-sm text-amber-900" href={`mailto:${supportEmail}?subject=Payment%20Recovery%20${encodeURIComponent(reference)}`}>
                Contact support
              </a>
            </div>
            {retryError && <p className="mt-3 text-sm text-red-700">{retryError}</p>}
            {retryMismatchMessages.length > 0 && (
              <ul className="mt-3 list-disc pl-6 text-sm text-red-700">
                {retryMismatchMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6">
          <Link href="/orders" className="text-indigo-600">
            View your orders
          </Link>
        </div>
      </div>
    </div>
  )
}

const prisma = new PrismaClient()

export const getServerSideProps: GetServerSideProps<CheckoutResultProps> = async ({ query }) => {
  const queryReference = Array.isArray(query.reference) ? query.reference[0] : query.reference
  const queryStatus = Array.isArray(query.status) ? query.status[0] : query.status

  const reference = typeof queryReference === 'string' ? queryReference : null
  const fallbackStatus = normalizeStatus(typeof queryStatus === 'string' ? queryStatus : null)

  if (!reference) {
    return {
      props: {
        reference: null,
        status: fallbackStatus,
        order: null
      }
    }
  }

  const order = await prisma.order.findUnique({
    where: { paystackReference: reference },
    include: {
      items: true
    }
  })

  if (!order) {
    return {
      props: {
        reference,
        status: fallbackStatus,
        order: null
      }
    }
  }

  return {
    props: {
      reference,
      status: normalizeStatus(order.status),
      order: {
        id: order.id,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        status: order.status,
        paystackReference: order.paystackReference,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => {
          const snapshot = item as any
          return {
            id: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productTitle: snapshot.productTitleSnapshot || 'Product unavailable',
            productSku: snapshot.productSkuSnapshot || ''
          }
        })
      }
    }
  }
}
