import { useState } from 'react'
import axios from 'axios'
import Router from 'next/router'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  async function submit(e: any) {
    e.preventDefault()
    try {
      await axios.post('/api/auth/register', { email, password, name })
      Router.push('/auth/signin')
    } catch (err) {
      alert('Error creating account')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="p-8 bg-white rounded shadow-md w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create account</h2>
        <label className="block">Name</label>
        <input className="w-full p-2 border mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block">Email</label>
        <input className="w-full p-2 border mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block">Password</label>
        <input className="w-full p-2 border mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full p-2 bg-indigo-600 text-white rounded">Create account</button>
      </form>
    </div>
  )
}
