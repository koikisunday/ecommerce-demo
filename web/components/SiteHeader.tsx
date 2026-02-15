import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CART_UPDATED_EVENT, getCartItemCount, readCart } from '../utils/cart'

export default function SiteHeader() {
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    const syncCartCount = () => {
      setCartCount(getCartItemCount(readCart()))
    }

    syncCartCount()
    window.addEventListener('storage', syncCartCount)
    window.addEventListener(CART_UPDATED_EVENT, syncCartCount as EventListener)

    return () => {
      window.removeEventListener('storage', syncCartCount)
      window.removeEventListener(CART_UPDATED_EVENT, syncCartCount as EventListener)
    }
  }, [])

  return (
    <header className="relative z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold text-slate-900">
          E-commerce Demo
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/cart" className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50">
            Cart ({cartCount})
          </Link>
          <Link href="/checkout" className="rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500">
            Checkout
          </Link>
          <Link href="/orders" className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50">
            Orders
          </Link>
        </nav>
      </div>
    </header>
  )
}
