export type CartItem = {
  productId: number
  quantity: number
}

const CART_STORAGE_KEY = 'ecommerce-demo-cart-v1'

function isValidCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== 'object') return false
  const candidate = item as { productId?: unknown; quantity?: unknown }
  return (
    typeof candidate.productId === 'number' &&
    Number.isInteger(candidate.productId) &&
    candidate.productId > 0 &&
    typeof candidate.quantity === 'number' &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity > 0
  )
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(CART_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidCartItem)
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function addToCart(productId: number, quantity = 1): CartItem[] {
  const current = readCart()
  const existing = current.find((item) => item.productId === productId)

  const next = existing
    ? current.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item
      )
    : [...current, { productId, quantity }]

  writeCart(next)
  return next
}

export function setCartItemQuantity(productId: number, quantity: number): CartItem[] {
  const current = readCart()

  const next =
    quantity <= 0
      ? current.filter((item) => item.productId !== productId)
      : current.map((item) => (item.productId === productId ? { ...item, quantity } : item))

  writeCart(next)
  return next
}

export function removeFromCart(productId: number): CartItem[] {
  const current = readCart()
  const next = current.filter((item) => item.productId !== productId)
  writeCart(next)
  return next
}
