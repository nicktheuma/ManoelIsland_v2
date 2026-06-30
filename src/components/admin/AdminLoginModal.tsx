import { useState } from 'react'
import { useAdmin } from '../../context/AdminProvider'
import { supportsSupabaseAdminAuth } from '../../utils/adminAuth'

export function AdminLoginModal() {
  const { isLoginOpen, closeLogin, loginWithEmail, loginDev } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [devPassword, setDevPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabaseAuthEnabled = supportsSupabaseAdminAuth()

  if (!isLoginOpen) return null

  const handleSupabaseSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const result = await loginWithEmail(email.trim(), password)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.message ?? 'Access denied.')
      return
    }

    setEmail('')
    setPassword('')
    setError('')
  }

  const handleDevSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!loginDev(devPassword)) {
      setError('Invalid password.')
      return
    }
    setDevPassword('')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-medium text-white">Admin Access</h2>
        <p className="mb-4 text-sm text-slate-400">
          {supabaseAuthEnabled
            ? 'Sign in with your Supabase admin account.'
            : 'Enter the sandbox development password.'}
        </p>

        {supabaseAuthEnabled ? (
          <form onSubmit={(event) => void handleSupabaseSubmit(event)} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
              placeholder="Admin email"
              autoFocus
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
              placeholder="Password"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
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
                disabled={isSubmitting}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDevSubmit} className="space-y-3">
            <input
              type="password"
              value={devPassword}
              onChange={(event) => setDevPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
              placeholder="Password"
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
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
        )}

        {supabaseAuthEnabled && (
          <details className="mt-4 border-t border-slate-800 pt-4">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
              Development password
            </summary>
            <form onSubmit={handleDevSubmit} className="mt-3 space-y-2">
              <input
                type="password"
                value={devPassword}
                onChange={(event) => setDevPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                placeholder="Dev password"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
              >
                Use dev access
              </button>
            </form>
          </details>
        )}
      </div>
    </div>
  )
}
