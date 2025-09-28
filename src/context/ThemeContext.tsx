import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ThemeContext, type Theme, type ThemeContextValue } from './ThemeContext.shared'

const STORAGE_KEY = 'user-theme-preference'

function getSystemPreference(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return getSystemPreference()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  function applyTheme(nextTheme: Theme) {
    if (typeof window === 'undefined') {
      return
    }

    const root = window.document.documentElement
    root.dataset.theme = nextTheme
    root.style.colorScheme = nextTheme

    if (nextTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getInitialTheme()
    applyTheme(initial)
    return initial
  })

  useEffect(() => {
    applyTheme(theme)

    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => {
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
      }
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export type { Theme }
