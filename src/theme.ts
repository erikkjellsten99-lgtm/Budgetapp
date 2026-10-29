// Utseende: Automatiskt (följer telefonen), Ljust eller Mörkt. Valet sparas på telefonen (localStorage)
// och sätts som data-theme på <html>, som CSS:en läser (se @media (prefers-color-scheme: dark) i styles.css och vanor.css).
// index.html sätter samma sak innan appen laddas, så att det inte blinkar ljust.

export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'groundwork-tema'
const BAR = { light: '#f4f5ef', dark: '#111713' }

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme
  // Statusfältets färg på telefonen följer valet.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const light = meta.media.includes('light')
    meta.content = theme === 'auto' ? (light ? BAR.light : BAR.dark) : BAR[theme]
  })
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Utan lagring gäller valet bara tills appen stängs.
  }
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent('groundwork-tema', { detail: theme }))
}
