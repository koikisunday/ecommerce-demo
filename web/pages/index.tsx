import Head from 'next/head'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { PrismaClient } from '@prisma/client'
import { addToCart } from '../utils/cart'

const ThreeBackground = dynamic(() => import('../components/ThreeBackground'), { ssr: false })

type ProductCard = {
  id: number
  title: string
  description: string | null
  price: number
  inventory: number
}

type HomeProps = {
  products: ProductCard[]
}

export default function Home({ products }: HomeProps) {
  const [message, setMessage] = useState<string | null>(null)

  function handleAddToCart(productId: number) {
    addToCart(productId, 1)
    setMessage('Added to cart')
    window.setTimeout(() => setMessage(null), 1200)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Head>
        <title>E-commerce Demo</title>
      </Head>

      <ThreeBackground />

      <main className="relative z-10 mx-auto w-full max-w-6xl p-8">
        <div className="mb-8 rounded-xl bg-white/90 p-6 shadow-lg backdrop-blur">
          <h1 className="text-3xl font-bold">Welcome to your multi-vendor store</h1>
          <p className="mt-2 text-gray-600">Add products to cart, review them in Cart, then checkout with Paystack.</p>
          <Link href="/cart" className="mt-4 inline-block rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Open cart
          </Link>
          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <article key={product.id} className="rounded-xl bg-white/90 p-5 shadow-lg backdrop-blur">
              <h2 className="text-xl font-semibold">{product.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{product.description ?? 'No description available.'}</p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">${(product.price / 100).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Stock: {product.inventory}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddToCart(product.id)}
                  disabled={product.inventory <= 0}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Add to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}

const prisma = new PrismaClient()

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      inventory: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return { props: { products } }
}
