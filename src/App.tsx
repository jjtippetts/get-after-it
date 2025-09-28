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
import GroupsList from './pages/GroupsList'
import CreateGroup from './pages/CreateGroup'
import GroupDetails from './pages/GroupDetails'
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
            <GroupsList />
          </RequireAuth>
        )
      },
      {
        path: 'groups',
        element: (
          <RequireAuth>
            <GroupsList />
          </RequireAuth>
        )
      },
      {
        path: 'groups/new',
        element: (
          <RequireAuth>
            <CreateGroup />
          </RequireAuth>
        )
      },
      {
        path: 'groups/:groupId',
        element: (
          <RequireAuth>
            <GroupDetails />
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const handleSignOut = async () => {
    try {
      setMobileMenuOpen(false)
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
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-4 text-sm md:flex">
              {user ? (
                <>
                  <Link className="text-slate-300 transition hover:text-white" to="/groups">
                    Groups
                  </Link>
                  <Link className="text-slate-300 transition hover:text-white" to="/groups/new">
                    Create group
                  </Link>
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
            <button
              type="button"
              onClick={() => setMobileMenuOpen((state) => !state)}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-6 w-6"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6m0 12L6 6" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div className="border-t border-slate-800 bg-slate-950 md:hidden" id="mobile-navigation">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 text-sm">
              {user ? (
                <>
                  <div className="flex items-center gap-3 text-slate-200">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? 'User avatar'}
                        className="h-10 w-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <div className="flex flex-col">
                      <span className="font-medium">{user.displayName ?? user.email}</span>
                      <span className="text-xs text-slate-400">Signed in</span>
                    </div>
                  </div>
                  <Link
                    className="text-slate-300 transition hover:text-white"
                    to="/groups"
                    onClick={closeMobileMenu}
                  >
                    Groups
                  </Link>
                  <Link
                    className="text-slate-300 transition hover:text-white"
                    to="/groups/new"
                    onClick={closeMobileMenu}
                  >
                    Create group
                  </Link>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={handleSignOut}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    className="text-slate-300 transition hover:text-white"
                    to="/sign-in"
                    onClick={closeMobileMenu}
                  >
                    Sign in
                  </Link>
                  <Link
                    className="text-slate-300 transition hover:text-white"
                    to="/sign-up"
                    onClick={closeMobileMenu}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
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
