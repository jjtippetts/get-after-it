import {
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { useState, type ReactNode, useMemo } from 'react'

import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import GroupsList from './pages/GroupsList'
import CreateGroup from './pages/CreateGroup'
import GroupDetails from './pages/GroupDetails'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/useTheme'

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
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const navLinkClass = useMemo(
    () =>
      `transition ${
        isDark
          ? 'text-slate-300 hover:text-white'
          : 'text-slate-600 hover:text-slate-900'
      }`,
    [isDark]
  )

  const brandTextClass = isDark ? 'text-white' : 'text-slate-900'
  const headerBorderClass = isDark ? 'border-slate-800' : 'border-slate-200'
  const userTextClass = isDark ? 'text-slate-300' : 'text-slate-700'
  const actionButtonClass = `rounded-lg border px-3 py-1 text-sm font-medium transition ${
    isDark
      ? 'border-slate-700 text-slate-200 hover:border-sky-500 hover:text-white'
      : 'border-slate-300 text-slate-700 hover:border-sky-500 hover:text-slate-900'
  }`

  const themeButtonClass = `rounded-lg px-3 py-1 text-sm font-medium transition ${
    isDark
      ? 'border border-slate-700 text-slate-200 hover:border-sky-500 hover:text-white'
      : 'border border-slate-300 text-slate-700 hover:border-sky-500 hover:text-slate-900'
  }`

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

  const themeButtonLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100`}
    >
      <header className={`border-b ${headerBorderClass}`}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link to="/" className={`text-lg font-semibold ${brandTextClass}`}>
            Get After It
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={toggleTheme}
              className={themeButtonClass}
              aria-label={themeButtonLabel}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            {user ? (
              <>
                <Link className={navLinkClass} to="/groups">
                  Groups
                </Link>
                <Link className={navLinkClass} to="/groups/new">
                  Create group
                </Link>
                <div className={`flex items-center gap-2 ${userTextClass}`}>
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
                  className={`${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <>
                <Link className={navLinkClass} to="/sign-in">
                  Sign in
                </Link>
                <Link className={navLinkClass} to="/sign-up">
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
      <div className="flex justify-center py-20 text-slate-500 dark:text-slate-300">
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
