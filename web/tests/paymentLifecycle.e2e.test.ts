import { createMocks } from 'node-mocks-http'
import checkoutHandler from '../pages/api/checkout'
import verifyHandler from '../pages/api/paystack/verify'
import { PrismaClient } from '@prisma/client'
import * as nextAuthReact from 'next-auth/react'
import * as paystack from '../utils/paystack'

jest.mock('next-auth/react', () => ({
  getSession: jest.fn()
}))

jest.mock('../utils/paystack', () => ({
  initializeTransaction: jest.fn(),
  verifyTransaction: jest.fn()
}))

jest.mock('@prisma/client', () => {
  type Product = {
    id: number
    title: string
    sku: string
    price: number
    inventory: number
  }

  type Order = {
    id: number
    customerEmail: string
    customerName: string | null
    totalAmount: number
    status: string
    paystackReference: string | null
    createdAt: Date
  }

  type OrderItem = {
    id: number
    orderId: number
    productId: number
    quantity: number
    unitPrice: number
    productTitleSnapshot: string
    productSkuSnapshot: string
  }

  type Payment = {
    id: number
    orderId: number
    amount: number
    provider: string
    status: string
    reference: string | null
    rawPayload: string | null
  }

  const state = {
    products: [] as Product[],
    orders: [] as Order[],
    orderItems: [] as OrderItem[],
    payments: [] as Payment[],
    nextOrderId: 1,
    nextOrderItemId: 1,
    nextPaymentId: 1
  }

  const resetState = () => {
    state.products = [{ id: 1, title: 'Lifecycle Product', sku: 'LC-1', price: 2000, inventory: 5 }]
    state.orders = []
    state.orderItems = []
    state.payments = []
    state.nextOrderId = 1
    state.nextOrderItemId = 1
    state.nextPaymentId = 1
  }

  const prisma: any = {}

  Object.assign(prisma, {
    __state: state,
    __reset: resetState,
    product: {
      findMany: jest.fn(async (args: any) => {
        const ids = args?.where?.id?.in
        if (Array.isArray(ids)) return state.products.filter((product) => ids.includes(product.id))
        return state.products
      }),
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id
        return state.products.find((product) => product.id === id) ?? null
      }),
      updateMany: jest.fn(async (args: any) => {
        const id = args?.where?.id
        const required = args?.where?.inventory?.gte
        const product = state.products.find((entry) => entry.id === id)
        if (!product || typeof required !== 'number' || product.inventory < required) {
          return { count: 0 }
        }

        const decrement = args?.data?.inventory?.decrement ?? 0
        product.inventory -= decrement
        return { count: 1 }
      })
    },
    order: {
      create: jest.fn(async (args: any) => {
        const order: Order = {
          id: state.nextOrderId++,
          customerEmail: args.data.customerEmail,
          customerName: args.data.customerName ?? null,
          totalAmount: args.data.totalAmount,
          status: args.data.status ?? 'PENDING',
          paystackReference: args.data.paystackReference ?? null,
          createdAt: new Date()
        }
        state.orders.push(order)

        for (const item of args.data.items.create) {
          const productId = item.productId ?? item.product?.connect?.id
          state.orderItems.push({
            id: state.nextOrderItemId++,
            orderId: order.id,
            productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productTitleSnapshot: item.productTitleSnapshot ?? '',
            productSkuSnapshot: item.productSkuSnapshot ?? ''
          })
        }

        return { ...order }
      }),
      update: jest.fn(async (args: any) => {
        const id = args?.where?.id
        const order = state.orders.find((entry) => entry.id === id)
        if (!order) throw new Error('Order not found')
        Object.assign(order, args.data)
        return { ...order }
      }),
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id
        const reference = args?.where?.paystackReference
        const order = state.orders.find((entry) =>
          typeof id === 'number' ? entry.id === id : entry.paystackReference === reference
        )
        if (!order) return null

        if (args?.select) {
          const result: Record<string, unknown> = {}
          for (const [key, enabled] of Object.entries(args.select)) {
            if (enabled) result[key] = (order as Record<string, unknown>)[key]
          }
          return result
        }

        if (args?.include?.items) {
          return {
            ...order,
            items: state.orderItems.filter((item) => item.orderId === order.id)
          }
        }

        return { ...order }
      })
    },
    payment: {
      findFirst: jest.fn(async (args: any) => {
        return (
          state.payments.find(
            (payment) =>
              payment.reference === args?.where?.reference && payment.provider === args?.where?.provider
          ) ?? null
        )
      }),
      create: jest.fn(async (args: any) => {
        const payment: Payment = {
          id: state.nextPaymentId++,
          orderId: args.data.orderId,
          amount: args.data.amount,
          provider: args.data.provider,
          status: args.data.status,
          reference: args.data.reference ?? null,
          rawPayload: args.data.rawPayload ?? null
        }
        state.payments.push(payment)
        return payment
      })
    },
    $transaction: jest.fn(async (callback: any) => callback(prisma))
  })

  resetState()

  return {
    PrismaClient: jest.fn(() => prisma)
  }
})

describe('Payment lifecycle integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    ;(nextAuthReact.getSession as jest.Mock).mockResolvedValue({
      user: { email: 'buyer@example.com', name: 'Buyer Test' }
    })
    ;(paystack.initializeTransaction as jest.Mock).mockResolvedValue({
      data: { authorization_url: 'https://paystack.test/pay', reference: 'ref-lifecycle-1' }
    })
    ;(paystack.verifyTransaction as jest.Mock).mockResolvedValue({
      data: { status: 'success', reference: 'ref-lifecycle-1', amount: 4000 }
    })

    const prismaAny: any = new PrismaClient()
    prismaAny.__reset()
  })

  test('cart -> checkout -> verify -> inventory decrement -> result redirect', async () => {
    const prismaAny: any = new PrismaClient()

    const checkout = createMocks({
      method: 'POST',
      body: {
        items: [{ productId: 1, quantity: 2, expectedUnitPrice: 2000 }]
      }
    })
    await checkoutHandler(checkout.req as any, checkout.res as any)

    expect(checkout.res._getStatusCode()).toBe(200)
    const checkoutData = JSON.parse(checkout.res._getData())
    expect(checkoutData.reference).toBe('ref-lifecycle-1')

    const createdOrder = prismaAny.__state.orders[0]
    expect(createdOrder.totalAmount).toBe(4000)
    expect(createdOrder.status).toBe('PENDING')
    expect(prismaAny.__state.orderItems[0].productTitleSnapshot).toBe('Lifecycle Product')
    expect(prismaAny.__state.orderItems[0].productSkuSnapshot).toBe('LC-1')

    const verify = createMocks({ method: 'GET', query: { reference: 'ref-lifecycle-1' } })
    await verifyHandler(verify.req as any, verify.res as any)

    expect(verify.res._getStatusCode()).toBe(302)
    expect(verify.res._getRedirectUrl()).toContain('/checkout/result?reference=ref-lifecycle-1&status=PAID')
    expect(prismaAny.__state.orders[0].status).toBe('PAID')
    expect(prismaAny.__state.products[0].inventory).toBe(3)
    expect(prismaAny.__state.orderItems[0].productTitleSnapshot).toBe('Lifecycle Product')
    expect(prismaAny.__state.orderItems[0].productSkuSnapshot).toBe('LC-1')
  })
})
