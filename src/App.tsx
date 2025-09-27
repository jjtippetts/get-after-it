import { Link, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />
      }
    ]
  }
])

function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Get After It</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-slate-300 transition hover:text-white" to="/">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}

function HomePage() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 shadow-xl shadow-slate-950/40">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let&apos;s build something awesome</h1>
      <p className="mt-4 text-slate-300">
        Your Firebase powered React experience starts here. Update this page as you flesh out routes,
        authentication, and data fetching.
      </p>
    </section>
  )
}

export function App() {
  return <RouterProvider router={router} />
}

export default App
