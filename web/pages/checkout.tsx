import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { PrismaClient } from '@prisma/client'
import { readCart, removeFromCart, setCartItemQuantity, writeCart, type CartItem } from '../utils/cart'

type ProductForCheckout = {
  id: number
  title: string
  description: string | null
  price: number
  inventory: number
}

type CheckoutProps = {
  products: ProductForCheckout[]
}

export default function CheckoutPage({ products }: CheckoutProps) {
  const [email, setEmail] = useState('customer@example.com')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const viewItems = useMemo(() => {
    return cartItems.flatMap((item) => {
      const product = productMap.get(item.productId)
      if (!product || product.inventory < 1) return []

      return [
        {
          product,
          quantity: Math.max(1, Math.min(item.quantity, product.inventory))
        }
      ]
    })
  }, [cartItems, productMap])

  const checkoutItems = useMemo(() => {
    return viewItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity
    }))
  }, [viewItems])

  const total = useMemo(() => {
    return viewItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  }, [viewItems])

  useEffect(() => {
    const sanitizedCart = readCart().flatMap((item) => {
      const product = productMap.get(item.productId)
      if (!product || product.inventory < 1) return []

      return [
        {
          productId: item.productId,
          quantity: Math.max(1, Math.min(item.quantity, product.inventory))
        }
      ]
    })

    writeCart(sanitizedCart)
    setCartItems(sanitizedCart)
    setIsLoaded(true)
  }, [productMap])

  async function startCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)

    if (checkoutItems.length === 0) {
      setErrorMessage('Your cart is empty. Add products before checkout.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await axios.post('/api/checkout', {
        customerEmail: email,
        customerName: 'Guest',
        items: checkoutItems
      })
      window.location.href = res.data.authorization_url
    } catch (err) {
      console.error(err)
      setErrorMessage('Error starting checkout. Please try again.')
      setIsSubmitting(false)
    }
  }

  function updateQuantity(productId: number, quantity: number) {
    const next = setCartItemQuantity(productId, quantity)
    setCartItems(next)
  }

  function removeItem(productId: number) {
    const next = removeFromCart(productId)
    setCartItems(next)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <Link href="/" className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
            Continue shopping
          </Link>
        </div>

        {!isLoaded && <p>Loading cart...</p>}

        {isLoaded && viewItems.length === 0 && (
          <div className="rounded border border-dashed border-gray-300 p-6 text-center">
            <p className="text-gray-600">Your cart is empty.</p>
            <Link href="/" className="mt-3 inline-block text-indigo-600">
              Go to products
            </Link>
          </div>
        )}

        {isLoaded && viewItems.length > 0 && (
          <form onSubmit={startCheckout}>
            <ul className="space-y-3">
              {viewItems.map(({ product, quantity }) => (
                <li key={product.id} className="rounded border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{product.title}</h2>
                      <p className="text-sm text-gray-600">{product.description ?? 'No description available.'}</p>
                      <p className="mt-1 text-sm font-medium">${(product.price / 100).toFixed(2)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border px-3 py-1"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                      >
                        -
                      </button>
                      <span className="w-10 text-center">{quantity}</span>
                      <button
                        type="button"
                        className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.inventory}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50"
                        onClick={() => removeItem(product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-gray-700">Order total</span>
                <span className="text-xl font-bold">${(total / 100).toFixed(2)}</span>
              </div>

              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                className="mb-3 w-full rounded border p-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {errorMessage && <p className="mb-3 text-sm text-red-600">{errorMessage}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded bg-indigo-600 p-2 text-white disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {isSubmitting ? 'Starting checkout...' : 'Pay with Paystack'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const prisma = new PrismaClient()

export const getServerSideProps: GetServerSideProps<CheckoutProps> = async () => {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      inventory: true
    }
  })

  return { props: { products } }
}
