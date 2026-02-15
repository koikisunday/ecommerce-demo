import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type OrderItemView = {
  id: number
  productId: number
  productTitleSnapshot?: string | null
  productSkuSnapshot?: string | null
  quantity: number
  unitPrice: number
}

type OrderView = {
  id: number
  paystackReference: string | null
  status: string
  totalAmount: number
  items: OrderItemView[]
}

type OrdersPageProps = {
  orders: OrderView[]
}

export default function OrdersPage({ orders }: OrdersPageProps) {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Your Orders</h1>
      {orders.length === 0 && <p>No orders found.</p>}
      <ul>
        {orders.map((o) => (
          <li key={o.id} className="p-3 border rounded mb-2">
            <div><strong>Reference:</strong> {o.paystackReference ?? '—'}</div>
            <div><strong>Status:</strong> {o.status}</div>
            <div><strong>Total:</strong> {o.totalAmount}</div>
            <div><strong>Items:</strong>
              <ul>
                {o.items.map((it) => (
                  <li key={it.id}>
                    {it.productTitleSnapshot || `Product #${it.productId}`}
                    {it.productSkuSnapshot ? ` (${it.productSkuSnapshot})` : ''}
                    {' '}
                    - {it.quantity} x ${(it.unitPrice / 100).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
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

  const orders = await prisma.order.findMany({ where: { customerEmail: session.user.email }, include: { items: true } })
  return { props: { orders } satisfies OrdersPageProps }
}
