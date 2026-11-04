// Gemensamma rörelser för Vanor-korten (veckans soluppgång och månadens solsystem).
// Allt respekterar "reducerad rörelse" i telefonen och pausar när kortet inte syns.

import { useEffect, useRef, useState, type RefObject } from 'react'

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Glider mjukt mot målvärdet: från 0 när kortet visas, och från förra värdet när det ändras (t.ex. en ny bock).
 * Med "reducerad rörelse" i telefonen hoppar värdet direkt.
 */
export function useGlide(target: number, active: boolean, ms = 1400): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  const current = useRef(value)
  useEffect(() => {
    if (!active && !reducedMotion()) {
      // Dold flik: börja om från horisonten nästa gång kortet syns
      current.current = 0
      setValue(0)
      return
    }
    if (reducedMotion()) {
      current.current = target
      setValue(target)
      return
    }
    const from = current.current
    if (from === target) return
    const start = performance.now()
    const duration = from === 0 ? ms : ms * 0.6
    let frame = 0
    const step = (now: number) => {
      // requestAnimationFrame kan ge en tid strax före start – håll t mellan 0 och 1
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      const eased = 1 - Math.pow(1 - t, 3)
      current.current = from + (target - from) * eased
      setValue(current.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, active, ms])
  return value
}

/** Sant när elementet syns på skärmen (Vanor-fliken ligger laddad i bakgrunden). */
export function useVisible<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, visible]
}

/** Sant en kort stund när värdet ökar efter första visningen (ljuspulsen när du bockar). */
export function useRisePulse(value: number): boolean {
  const last = useRef(value)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (value > last.current && !reducedMotion()) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1200)
      last.current = value
      return () => clearTimeout(t)
    }
    last.current = value
  }, [value])
  return pulse
}


/**
 * Tid i sekunder som tickar medan `running` är sant (cirka 30 bilder i sekunden), för långsamma banor.
 * Står still när kortet inte syns, när något är valt eller med reducerad rörelse.
 */
export function usePhase(running: boolean): number {
  const [phase, setPhase] = useState(0)
  const base = useRef(0)
  useEffect(() => {
    if (!running || reducedMotion()) return
    const start = performance.now()
    const from = base.current
    let frame = 0
    let lastPaint = 0
    const step = (now: number) => {
      if (now - lastPaint > 33) {
        lastPaint = now
        base.current = from + (now - start) / 1000
        setPhase(base.current)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [running])
  return phase
}
