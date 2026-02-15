import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default function AdminOrdersPage({ orders }: any) {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">All Orders (Admin)</h1>
      {orders.length === 0 && <p>No orders found.</p>}
      <ul>
        {orders.map((o: any) => (
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
  return { props: { orders } }
}
