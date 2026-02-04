import { useState } from 'react'
import axios from 'axios'
import Router from 'next/router'

export default function CheckoutPage() {
  const [email, setEmail] = useState('customer@example.com')
  const [items, setItems] = useState([{ productId: 1, quantity: 1 }])

  async function startCheckout(e: any) {
    e.preventDefault()
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
        <textarea className="w-full p-2 border mb-3 h-24" value={JSON.stringify(items)} onChange={(e) => setItems(JSON.parse(e.target.value))} />
        <button className="w-full p-2 bg-indigo-600 text-white rounded">Pay with Paystack</button>
      </form>
    </div>
  )
}
