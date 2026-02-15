import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { PrismaClient } from '@prisma/client'
import Link from 'next/link'

const prisma = new PrismaClient()

type AdminOrderView = {
  id: number
  paystackReference: string | null
  customerEmail: string
  status: string
  totalAmount: number
}

type AdminOrdersPageProps = {
  orders: AdminOrderView[]
}

export default function AdminOrdersPage({ orders }: AdminOrdersPageProps) {
  return (
    <div className="min-h-screen p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Orders (Admin)</h1>
        <Link href="/admin/inventory" className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          Manage inventory
        </Link>
      </div>
      {orders.length === 0 && <p>No orders found.</p>}
      <ul>
        {orders.map((o) => (
          <li key={o.id} className="p-3 border rounded mb-2">
            <div><strong>Reference:</strong> {o.paystackReference ?? '—'}</div>
            <div><strong>Customer:</strong> {o.customerEmail}</div>
            <div><strong>Status:</strong> {o.status}</div>
            <div><strong>Total:</strong> {o.totalAmount}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession({ req: ctx.req } as any)
  if (!session?.user?.email) {
    return { redirect: { destination: '/auth/signin', permanent: false } }
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user || (user.role !== 'ADMIN' && user.role !== 'VENDOR')) {
    return { redirect: { destination: '/', permanent: false } }
  }

  // Admin sees all orders; vendor could filter by their products in future
  const orders = await prisma.order.findMany({ include: { items: true } })
  return { props: { orders } satisfies AdminOrdersPageProps }
}
