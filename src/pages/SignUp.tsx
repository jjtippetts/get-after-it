import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

import { useAuth } from '../context/AuthContext'
import { auth, db } from '../lib/firebase'

export default function SignUp() {
  const navigate = useNavigate()
  const { loading, user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const persistProfile = async (
    user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null },
    metadata?: { displayName?: string; photoURL?: string; isNew?: boolean }
  ) => {
    const payload = {
      email: user.email,
      displayName: metadata?.displayName ?? user.displayName ?? '',
      photoURL: metadata?.photoURL ?? user.photoURL ?? '',
      updatedAt: serverTimestamp(),
      ...(metadata?.isNew ? { createdAt: serverTimestamp() } : {})
    }

    await setDoc(doc(db, 'users', user.uid), payload, { merge: true })
  }

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setFormBusy(true)

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, {
        displayName: displayName || credential.user.displayName || '',
        photoURL: photoURL || credential.user.photoURL || undefined
      })
      await persistProfile(credential.user, { displayName, photoURL, isNew: true })
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Unable to sign up. Please try again later.')
    } finally {
      setFormBusy(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setFormBusy(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      const user = credential.user
      const googleCredential = credential as unknown as {
        _tokenResponse?: { isNewUser?: boolean }
      }
      await persistProfile(user, {
        isNew: googleCredential._tokenResponse?.isNewUser,
        displayName: user.displayName ?? undefined,
        photoURL: user.photoURL ?? undefined
      })
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Google sign-up failed. Please try again.')
    } finally {
      setFormBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-slate-950/30">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create your account</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-medium text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Display name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-200/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/50"
            placeholder="What should we call you?"
            disabled={formBusy || loading}
          />
        </div>
        <div>
          <label htmlFor="photoURL" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Avatar URL
          </label>
          <input
            id="photoURL"
            value={photoURL}
            onChange={(event) => setPhotoURL(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-200/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/50"
            placeholder="https://example.com/avatar.png"
            disabled={formBusy || loading}
          />
        </div>
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
            autoComplete="new-password"
            disabled={formBusy || loading}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner shadow-slate-200/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:shadow-slate-950/50"
            required
            autoComplete="new-password"
            disabled={formBusy || loading}
          />
        </div>

        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={formBusy || loading}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {formBusy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={formBusy || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-500 hover:text-slate-900 disabled:cursor-not-allowed dark:border-slate-700 dark:text-white dark:hover:text-white dark:hover:border-sky-500"
        >
          <span>Sign up with Google</span>
        </button>
      </div>
    </div>
  )
}
