import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth'

import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

type RedirectState = {
  from?: {
    pathname: string
  }
}

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const from = (location.state as RedirectState | undefined)?.from?.pathname ?? '/'

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [from, loading, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormBusy(true)
    setError(null)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate(from, { replace: true })
    } catch (err) {
      console.error(err)
      setError('Unable to sign in. Please double-check your credentials.')
    } finally {
      setFormBusy(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setFormBusy(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate(from, { replace: true })
    } catch (err) {
      console.error(err)
      setError('Google sign-in failed. Please try again.')
    } finally {
      setFormBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-slate-950/30">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Sign in to your account</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        New here?{' '}
        <Link to="/sign-up" className="font-medium text-sky-400 hover:text-sky-300">
          Create an account
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-200/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/50"
            required
            autoComplete="email"
            disabled={formBusy || loading}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-200/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/50"
            required
            autoComplete="current-password"
            disabled={formBusy || loading}
          />
        </div>

        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={formBusy || loading}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {formBusy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={formBusy || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-500 hover:text-slate-900 disabled:cursor-not-allowed dark:border-slate-700 dark:text-white dark:hover:text-white dark:hover:border-sky-500"
        >
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  )
}
