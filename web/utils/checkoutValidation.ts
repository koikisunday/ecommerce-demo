import type { PrismaClient } from '@prisma/client'

export type CheckoutRequestItem = {
  productId: number
  quantity: number
  expectedUnitPrice?: number
}

export type CartMismatch =
  | {
      type: 'PRODUCT_NOT_FOUND'
      productId: number
      message: string
    }
  | {
      type: 'OUT_OF_STOCK'
      productId: number
      title: string
      requestedQuantity: number
      availableInventory: number
      message: string
    }
  | {
      type: 'PRICE_CHANGED'
      productId: number
      title: string
      expectedUnitPrice: number
      actualUnitPrice: number
      message: string
    }

export type BuildOrderDraftResult = {
  totalAmount: number
  orderItems: Array<{
    productId: number
    quantity: number
    unitPrice: number
    productTitleSnapshot: string
    productSkuSnapshot: string
  }>
  mismatches: CartMismatch[]
}

function formatMoney(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`
}

export async function buildOrderDraftFromItems(
  prisma: PrismaClient,
  items: CheckoutRequestItem[]
): Promise<BuildOrderDraftResult> {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, sku: true, price: true, inventory: true }
  })

  const productMap = new Map(products.map((product) => [product.id, product]))
  const mismatches: CartMismatch[] = []
  const orderItems: BuildOrderDraftResult['orderItems'] = []
  let totalAmount = 0

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      mismatches.push({
        type: 'PRODUCT_NOT_FOUND',
        productId: item.productId,
        message: `Product #${item.productId} is no longer available.`
      })
      continue
    }

    if (item.quantity > product.inventory) {
      mismatches.push({
        type: 'OUT_OF_STOCK',
        productId: item.productId,
        title: product.title,
        requestedQuantity: item.quantity,
        availableInventory: product.inventory,
        message: `${product.title} only has ${product.inventory} left (requested ${item.quantity}).`
      })
      continue
    }

    if (typeof item.expectedUnitPrice === 'number' && item.expectedUnitPrice !== product.price) {
      mismatches.push({
        type: 'PRICE_CHANGED',
        productId: item.productId,
        title: product.title,
        expectedUnitPrice: item.expectedUnitPrice,
        actualUnitPrice: product.price,
        message: `${product.title} price changed from ${formatMoney(item.expectedUnitPrice)} to ${formatMoney(product.price)}.`
      })
      continue
    }

    orderItems.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
      productTitleSnapshot: product.title,
      productSkuSnapshot: product.sku
    })
    totalAmount += product.price * item.quantity
  }

  return { totalAmount, orderItems, mismatches }
}
