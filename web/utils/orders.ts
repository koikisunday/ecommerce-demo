import type { Prisma, PrismaClient } from '@prisma/client'

export class InventoryUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InventoryUnavailableError'
  }
}

type MarkOrderPaidInput = {
  orderId: number
  amount: number
  status: string
  reference: string
  rawPayload: unknown
}

export async function markOrderPaidWithInventory(prisma: PrismaClient, input: MarkOrderPaidInput) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true }
    })

    if (!order) return { applied: false as const, reason: 'ORDER_NOT_FOUND' as const }

    const existingPayment = await tx.payment.findFirst({
      where: { reference: input.reference, provider: 'paystack' }
    })

    if (!existingPayment) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: input.amount,
          provider: 'paystack',
          status: input.status,
          reference: input.reference,
          rawPayload: JSON.stringify(input.rawPayload)
        }
      })
    }

    if (order.status === 'PAID') {
      return { applied: true as const, alreadyPaid: true as const }
    }

    for (const item of order.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, inventory: { gte: item.quantity } },
        data: { inventory: { decrement: item.quantity } }
      })

      if (updated.count !== 1) {
        throw new InventoryUnavailableError(`Insufficient inventory for product ${item.productId}`)
      }
    }

    await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
    return { applied: true as const, alreadyPaid: false as const }
  })
}
