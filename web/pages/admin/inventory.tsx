import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { PrismaClient } from '@prisma/client'
import { getSession } from 'next-auth/react'

type AdminProduct = {
  id: number
  title: string
  sku: string
  inventory: number
  price: number
}

type AdminInventoryProps = {
  products: AdminProduct[]
}

export default function AdminInventoryPage({ products }: AdminInventoryProps) {
  const [inventoryById, setInventoryById] = useState<Record<number, number>>(
    () => Object.fromEntries(products.map((product) => [product.id, product.inventory]))
  )
  const [savingProductId, setSavingProductId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.title.localeCompare(b.title)), [products])

  async function saveInventory(product: AdminProduct) {
    const nextInventory = inventoryById[product.id]
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!Number.isInteger(nextInventory) || nextInventory < 0) {
      setErrorMessage('Inventory must be a non-negative integer.')
      return
    }

    setSavingProductId(product.id)
    try {
      const res = await axios.patch(`/api/admin/products/${product.id}/inventory`, {
        inventory: nextInventory
      })

      const updatedInventory = res.data?.product?.inventory
      if (typeof updatedInventory === 'number') {
        setInventoryById((current) => ({
          ...current,
          [product.id]: updatedInventory
        }))
      }

      setSuccessMessage(`Updated inventory for ${product.title}.`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(err.response?.data?.error ?? 'Failed to update inventory.')
      } else {
        setErrorMessage('Failed to update inventory.')
      }
    } finally {
      setSavingProductId(null)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Admin Inventory</h1>
          <div className="flex gap-2">
            <Link href="/admin/orders" className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
              View orders
            </Link>
            <Link href="/" className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
              Storefront
            </Link>
          </div>
        </div>

        {errorMessage && <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
        {successMessage && <p className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Inventory</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => (
                <tr key={product.id} className="border-b">
                  <td className="py-3 pr-3 font-medium">{product.title}</td>
                  <td className="py-3 pr-3 text-gray-600">{product.sku}</td>
                  <td className="py-3 pr-3">${(product.price / 100).toFixed(2)}</td>
                  <td className="py-3 pr-3">
                    <input
                      type="number"
                      min={0}
                      className="w-24 rounded border p-2"
                      value={inventoryById[product.id] ?? 0}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        setInventoryById((current) => ({
                          ...current,
                          [product.id]: Number.isNaN(value) ? 0 : value
                        }))
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => saveInventory(product)}
                      disabled={savingProductId === product.id}
                    >
                      {savingProductId === product.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const prisma = new PrismaClient()

export const getServerSideProps: GetServerSideProps<AdminInventoryProps> = async (ctx) => {
  const session = await getSession({ req: ctx.req } as any)
  if (!session?.user?.email) {
    return { redirect: { destination: '/auth/signin', permanent: false } }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true }
  })
  if (!user || (user.role !== 'ADMIN' && user.role !== 'VENDOR')) {
    return { redirect: { destination: '/', permanent: false } }
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      sku: true,
      price: true,
      inventory: true
    }
  })

  return { props: { products } }
}
