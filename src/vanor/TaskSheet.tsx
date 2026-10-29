import { useEffect, useRef, useState } from 'react'
import { addDays, todayKey } from './dates'
import { deleteTaskRecord, newId, saveTaskRecord } from './store'
import { TITLE_MAX, cleanTitle, type Task } from './tasks'

interface Props {
  /** Saken som ändras. Saknas = ny. */
  task?: Task
  onClose: () => void
}

/** Ark för att lägga till eller ändra en att göra-sak. */
export default function TaskSheet({ task, onClose }: Props) {
  const today = todayKey()
  const tomorrow = addDays(today, 1)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.date ?? today)
  const [time, setTime] = useState(task?.time ?? '')
  const [pickDate, setPickDate] = useState(!!task && task.date !== today && task.date !== tomorrow)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const error = tried && !cleanTitle(title) ? 'Skriv vad som ska göras.' : null

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    setTried(true)
    if (busy || !cleanTitle(title) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    setBusy(true)
    const next: Task = {
      ...(task ?? { id: newId(), created: Date.now() }),
      title: cleanTitle(title),
      date,
    }
    if (/^\d\d:\d\d$/.test(time)) next.time = time
    else delete next.time
    await saveTaskRecord(next)
    onClose()
  }

  async function remove() {
    if (!task) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    await deleteTaskRecord(task.id)
    onClose()
  }

  const choose = (value: string) => {
    setDate(value)
    setPickDate(false)
  }

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet task-sheet" role="dialog" aria-modal="true" aria-labelledby="task-title" onSubmit={save} noValidate>
        <div className="sheet-head">
          <h2 id="task-title">{task ? 'Ändra' : 'Att göra'}</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Avbryt
          </button>
        </div>

        <label className="field">
          <span>Vad ska göras?</span>
          <input
            ref={inputRef}
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="T.ex. Ring vårdcentralen"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={!!error}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="field">
          <span id="task-date-label">När?</span>
          <div className="date-chips" role="group" aria-labelledby="task-date-label">
            <button type="button" aria-pressed={!pickDate && date === today} onClick={() => choose(today)}>
              Idag
            </button>
            <button type="button" aria-pressed={!pickDate && date === tomorrow} onClick={() => choose(tomorrow)}>
              I morgon
            </button>
            <button type="button" aria-pressed={pickDate} onClick={() => setPickDate(true)}>
              Välj dag
            </button>
          </div>
          {pickDate && (
            <input type="date" value={date} aria-label="Datum" onChange={(e) => e.target.value && setDate(e.target.value)} />
          )}
        </div>

        <div className="field">
          <label htmlFor="task-time">Tid och påminnelse (valfri)</label>
          <div className="remind-row">
            <input id="task-time" type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
            {time && (
              <button type="button" className="text-btn" onClick={() => setTime('')}>
                Ingen
              </button>
            )}
          </div>
          <small className="field-help">Med en tid får du en notis då, om notiser är på.</small>
        </div>

        <button type="submit" className="primary t-save-task" disabled={busy}>
          {task ? 'Spara' : 'Lägg till'}
        </button>
        {task && (
          <button type="button" className="text-btn danger-text" disabled={busy} onClick={remove}>
            {confirmDelete ? 'Tryck igen för att ta bort' : 'Ta bort'}
          </button>
        )}
      </form>
    </div>
  )
}
