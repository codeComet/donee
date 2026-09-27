import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import Spinner from '../components/Spinner'

const APP_URL = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')

export default function LoginPage({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password })
      if (response?.error) throw new Error(response.error)
      if (response?.session) onSignIn(response.session)
    } catch (err) {
      setError(err.message || 'Sign in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function openWebPage(path) {
    const params = path === '/forgot-password' && email ? `?email=${encodeURIComponent(email)}` : ''
    chrome.tabs.create({ url: `${APP_URL}${path}${params}` })
  }

  const inputClass =
    'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="flex flex-col items-center justify-center py-10 bg-white px-8 space-y-6 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <CheckSquare className="w-7 h-7 text-white" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Donee</h1>
          <p className="text-xs text-slate-500 mt-0.5">Your task tracker, everywhere</p>
        </div>
      </div>

      <form onSubmit={handleSignIn} className="w-full space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={inputClass}
        />

        {APP_URL && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openWebPage('/forgot-password')}
              className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
          <span>{loading ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>

      {error && (
        <p className="w-full text-xs text-red-600 text-center bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {APP_URL && (
        <p className="text-xs text-slate-500 text-center">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => openWebPage('/')}
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Sign up
          </button>
        </p>
      )}
    </div>
  )
}
