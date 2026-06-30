import { useState } from 'react'
import { useAdmin } from '../../context/AdminProvider'

export function AdminLoginModal() {
  const { isLoginOpen, closeLogin, login } = useAdmin()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!isLoginOpen) return null

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!login(password)) {
      setError('Invalid password.')
      return
    }
    setPassword('')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <h2 className="mb-1 text-lg font-medium text-white">Admin Access</h2>
        <p className="mb-4 text-sm text-slate-400">Enter the sandbox admin password.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
          placeholder="Password"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeLogin}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            Login
          </button>
        </div>
      </form>
    </div>
  )
}
