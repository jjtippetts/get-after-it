import {
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { useState, type ReactNode } from 'react'

import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import HomePage from './pages/Home'
import { useAuth } from './context/AuthContext'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        )
      }
    ]
  },
  {
    path: '/sign-in',
    element: <SignIn />
  },
  {
    path: '/sign-up',
    element: <SignUp />
  }
])

function RootLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await signOut()
      navigate('/sign-in')
    } catch (error) {
      console.error('Sign out failed', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-white">
            Get After It
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <div className="flex items-center gap-2 text-slate-300">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? 'User avatar'}
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <span>{user.displayName ?? user.email}</span>
                </div>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <>
                <Link className="text-slate-300 transition hover:text-white" to="/sign-in">
                  Sign in
                </Link>
                <Link className="text-slate-300 transition hover:text-white" to="/sign-up">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-300">
        <span>Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function App() {
  return <RouterProvider router={router} />
}

export default App
