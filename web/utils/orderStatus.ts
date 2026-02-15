export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED'
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export function isOrderStatus(value: string): value is OrderStatus {
  return value === ORDER_STATUS.PENDING || value === ORDER_STATUS.PAID || value === ORDER_STATUS.FAILED
}

export function normalizeOrderStatus(value: string | null | undefined): OrderStatus | null {
  if (!value) return null
  const upper = value.toUpperCase()
  return isOrderStatus(upper) ? upper : null
}
