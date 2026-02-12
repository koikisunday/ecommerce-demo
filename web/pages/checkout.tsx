import { useState, type FormEvent } from 'react'
import axios from 'axios'

type CheckoutItem = {
  productId: number
  quantity: number
}

export default function CheckoutPage() {
  const [email, setEmail] = useState('customer@example.com')
  const [items, setItems] = useState<CheckoutItem[]>([{ productId: 1, quantity: 1 }])
  const [itemsText, setItemsText] = useState(JSON.stringify([{ productId: 1, quantity: 1 }]))
  const [itemsError, setItemsError] = useState<string | null>(null)

  async function startCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (itemsError) {
      alert('Please fix items JSON before checkout')
      return
    }

    try {
      const res = await axios.post('/api/checkout', { customerEmail: email, customerName: 'Guest', items })
      window.location.href = res.data.authorization_url
    } catch (err) {
      alert('Error starting checkout')
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={startCheckout} className="p-8 bg-white rounded shadow-md w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Checkout (demo)</h2>
        <label className="block">Email</label>
        <input className="w-full p-2 border mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block">Items (JSON)</label>
        <textarea
          className="w-full p-2 border mb-1 h-24"
          value={itemsText}
          onChange={(e) => {
            const value = e.target.value
            setItemsText(value)
            try {
              const parsed = JSON.parse(value)
              if (!Array.isArray(parsed)) {
                setItemsError('Items must be an array')
                return
              }
              setItems(parsed)
              setItemsError(null)
            } catch {
              setItemsError('Invalid JSON')
            }
          }}
        />
        {itemsError && <p className="text-sm text-red-600 mb-3">{itemsError}</p>}
        <button className="w-full p-2 bg-indigo-600 text-white rounded">Pay with Paystack</button>
      </form>
    </div>
  )
}
