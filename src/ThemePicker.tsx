import { useEffect, useState } from 'react'
import { getTheme, setTheme, type Theme } from './theme'

const OPTIONS: [Theme, string][] = [
  ['auto', 'Automatiskt'],
  ['light', 'Ljust'],
  ['dark', 'Mörkt'],
]

/** Välj utseende för hela appen. Automatiskt följer telefonens ljusa/mörka läge. */
export default function ThemePicker({ title = 'Utseende' }: { title?: string }) {
  const [theme, setLocal] = useState<Theme>(getTheme)

  // Håll flera väljare (Konto och Mina vanor) i takt.
  useEffect(() => {
    const onChange = (e: Event) => setLocal((e as CustomEvent<Theme>).detail)
    window.addEventListener('groundwork-tema', onChange)
    return () => window.removeEventListener('groundwork-tema', onChange)
  }, [])

  return (
    <section className="theme-picker" aria-labelledby="theme-title">
      <h3 id="theme-title">{title}</h3>
      <div className="theme-options" role="radiogroup" aria-labelledby="theme-title">
        {OPTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            className={theme === id ? 'on' : undefined}
            onClick={() => setTheme(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="theme-note">{theme === 'auto' ? 'Följer telefonens inställning.' : 'Gäller hela appen på den här telefonen.'}</p>
    </section>
  )
}
