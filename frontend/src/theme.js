import { useEffect, useState } from 'react'

// 'system' follows prefers-color-scheme; 'light'/'dark' are pinned and remembered per browser.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('gf-theme') || 'system' } catch { return 'system' }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try { localStorage.setItem('gf-theme', theme) } catch { /* private mode */ }
  }, [theme])
  return [theme, setTheme]
}
