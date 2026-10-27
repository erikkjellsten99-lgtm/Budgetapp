import { useEffect, useMemo, useState } from 'react';
import { isoWeek, todayKey, type DateKey } from '../vanor/dates';
import { sameName, type Habit } from '../vanor/habits';
import { loadHabitData, loadWorkouts, onHabitChange } from '../vanor/store';
import WorkoutSheet, { hasDraft } from './WorkoutSheet';
import {
  best5k,
  DEFAULT_5K_GOAL,
  exerciseSummaries,
  fiveKHistory,
  formatDuration,
  formatNumber,
  newestFirst,
  parseDuration,
  records,
  weekStats,
  workoutSummary,
  type ExerciseSummary,
  type Workout,
  type WorkoutKind,
} from './training';
import '../vanor/vanor.css';
import './traning.css';

const GOAL_KEY = 'traning-5k-mal';

function loadGoal(): number {
  try {
    const saved = Number(localStorage.getItem(GOAL_KEY));
    return saved > 0 ? saved : DEFAULT_5K_GOAL;
  } catch {
    return DEFAULT_5K_GOAL;
  }
}

/** Träningspassen och vanorna, uppdateras vid varje ändring (här eller via synken). */
function useTrainingData() {
  const [data, setData] = useState<{ workouts: Workout[]; habits: Habit[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([loadWorkouts<Workout>(), loadHabitData()]).then(
        ([workouts, h]) => alive && setData({ workouts, habits: h.habits }),
      );
    load();
    const stop = onHabitChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return data;
}

const DAYS = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "tis 27 okt" (och årtal om det inte är i år). */
export function shortDate(key: DateKey, today = todayKey()): string {
  const [y, m, d] = key.split('-').map(Number);
  const day = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const year = key.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${DAYS[day]} ${d} ${MONTHS[m - 1]}${year}`;
}

type Sheet = { kind: WorkoutKind; workout?: Workout } | null;

/** Fliken Träning: logga gym- och löppass och se hur du utvecklas. */
export default function Traning() {
  const data = useTrainingData();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const today = todayKey();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!data) return null;
  const { workouts, habits } = data;
  const gymHabit = habits.find((h) => !h.archived && sameName(h.name, 'Gym'));
  const week = weekStats(workouts, today);
  const list = newestFirst(workouts);
  const shown = showAll ? list : list.slice(0, 8);
  const draft = hasDraft();

  function saved(workout: Workout, all: Workout[]) {
    const prs = records(workout, all);
    setToast(
      prs.length
        ? `Nytt rekord i ${prs.join(' och ')}!`
        : workout.kind === 'gym'
          ? 'Gympasset är sparat.'
          : 'Löppasset är sparat.',
    );
  }

  return (
    <div className="vanor traning">
      <header className="top">
        <div className="head">
          <p className="date-line">Vecka {isoWeek(today)}</p>
          <h2 className="headline">
            {gymHabit ? `${week.gym} av ${gymHabit.goal} gympass` : `${week.gym} gympass`} den här veckan
          </h2>
          <p className="week-line">
            {week.runs
              ? `${week.runs} löppass · ${formatNumber(week.km, 1)} km`
              : 'Inga löppass än den här veckan'}
          </p>
        </div>
      </header>

      <div className="log-buttons">
        <button type="button" className="log-btn" onClick={() => setSheet({ kind: 'gym' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" />
          </svg>
          <span>
            <b>{draft ? 'Fortsätt gympasset' : 'Logga gympass'}</b>
            <small>{draft ? 'Du har ett pass som inte är sparat' : 'Övningar, vikter och reps'}</small>
          </span>
        </button>
        <button type="button" className="log-btn" onClick={() => setSheet({ kind: 'run' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13.5 5.5a1.6 1.6 0 1 0 0-.1M9 20l2.5-5 3 2.5V21M7 11l3-3h4l2.5 3.5 3 .5M11.5 15l1-5" />
          </svg>
          <span>
            <b>Logga löppass</b>
            <small>Distans och tid</small>
          </span>
        </button>
      </div>

      <FiveK workouts={workouts} />

      {workouts.length === 0 ? (
        <div className="all-done">
          <p>
            Inga pass än. Logga ditt första gym- eller löppass, så ser du här hur vikterna och 5 km-tiden utvecklas.
            {gymHabit && ' Gym bockas av i Vanor automatiskt.'}
          </p>
        </div>
      ) : (
        <>
          <Exercises summaries={exerciseSummaries(workouts)} today={today} />

          <section className="section" aria-labelledby="pass-title">
            <h2 className="section-title" id="pass-title">
              Senaste passen <span className="count">{list.length}</span>
            </h2>
            <ul className="t-list">
              {shown.map((w) => {
                const prs = records(w, workouts);
                return (
                  <li key={w.id}>
                    <button type="button" className="t-row" onClick={() => setSheet({ kind: w.kind, workout: w })}>
                      <span className={`kind-dot ${w.kind}`} aria-hidden="true" />
                      <span className="t-info">
                        <span className="t-title">
                          <b>{w.kind === 'gym' ? 'Gym' : 'Löpning'}</b>
                          <span>{shortDate(w.date, today)}</span>
                        </span>
                        <span className="t-sub">{workoutSummary(w)}</span>
                        {prs.length > 0 && <span className="pr-pill">Rekord: {prs.join(', ')}</span>}
                      </span>
                      <span className="chev" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {list.length > 8 && (
              <button type="button" className="text-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Visa färre' : `Visa alla ${list.length} pass`}
              </button>
            )}
          </section>
        </>
      )}

      {gymHabit && workouts.length > 0 && (
        <p className="quiet center">Gym bockas av i Vanor när du loggar ett gympass.</p>
      )}

      {toast && (
        <div className="t-toast" role="status">
          {toast}
        </div>
      )}

      {sheet && (
        <WorkoutSheet
          kind={sheet.kind}
          workout={sheet.workout}
          workouts={workouts}
          habits={habits}
          onSaved={saved}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/** Kortet för 5 km-målet: bästa tid, hur långt kvar och en graf. */
function FiveK({ workouts }: { workouts: Workout[] }) {
  const [goal, setGoal] = useState(loadGoal);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(formatDuration(goal));
  const best = best5k(workouts);
  const history = useMemo(() => fiveKHistory(workouts), [workouts]);
  const parsed = parseDuration(text);

  function saveGoal() {
    if (!parsed) return;
    setGoal(parsed);
    setEditing(false);
    try {
      localStorage.setItem(GOAL_KEY, String(parsed));
    } catch {
      // Målet sparas bara inte till nästa gång.
    }
  }

  const left = best ? best.seconds - goal : null;
  return (
    <section className="t-card five-k" aria-labelledby="fivek-title">
      <div className="five-k-head">
        <div>
          <h2 id="fivek-title">5 km</h2>
          <p className="t-big">{best ? formatDuration(best.seconds) : '–'}</p>
          <p className="t-muted">
            {best ? `Bästa tiden, ${shortDate(best.date)}` : 'Logga ett löppass på minst 5 km så räknas tiden här.'}
          </p>
        </div>
        <div className={left !== null && left <= 0 ? 'goal-badge reached' : 'goal-badge'}>
          {left === null ? (
            <>
              <span>Mål</span>
              <b>{formatDuration(goal)}</b>
            </>
          ) : left <= 0 ? (
            <>
              <span>Målet nått</span>
              <b>under {formatDuration(goal)}</b>
            </>
          ) : (
            <>
              <span>Kvar till {formatDuration(goal)}</span>
              <b>{formatDuration(left)}</b>
            </>
          )}
        </div>
      </div>

      {history.length >= 2 && (
        <Spark
          values={history.map((p) => p.seconds)}
          goal={goal}
          lowerIsBetter
          format={formatDuration}
          label="5 km-tiden över tid"
        />
      )}

      {editing ? (
        <div className="goal-edit">
          <label className="field">
            Mål för 5 km (min:sek)
            <input
              value={text}
              inputMode="numeric"
              placeholder="25:00"
              aria-invalid={!parsed}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
              autoFocus
            />
          </label>
          <button type="button" className="primary" disabled={!parsed} onClick={saveGoal}>
            Spara
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-btn small"
          onClick={() => {
            setText(formatDuration(goal));
            setEditing(true);
          }}
        >
          Ändra mål
        </button>
      )}
    </section>
  );
}

/** En rad per övning med senaste tyngsta set; tryck för graf. */
function Exercises({ summaries, today }: { summaries: ExerciseSummary[]; today: DateKey }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!summaries.length) return null;
  return (
    <section className="section" aria-labelledby="ex-title">
      <h2 className="section-title" id="ex-title">
        Övningar <span className="count">{summaries.length}</span>
      </h2>
      <ul className="t-list">
        {summaries.map((s) => {
          const isOpen = open === s.name;
          return (
            <li key={s.name}>
              <button
                type="button"
                className="t-row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.name)}
              >
                <span className="t-info">
                  <span className="t-title">
                    <b>{s.name}</b>
                  </span>
                  <span className="t-sub">
                    {s.points.length === 1
                      ? `Första gången ${shortDate(s.first.date, today)}`
                      : s.change > 0
                        ? `+${formatNumber(s.change)} kg sedan ${shortDate(s.first.date, today)}`
                        : s.change < 0
                          ? `${formatNumber(s.change).replace('-', '−')} kg sedan ${shortDate(s.first.date, today)}`
                          : `Samma vikt som ${shortDate(s.first.date, today)}`}
                  </span>
                </span>
                <span className="t-value">
                  {formatNumber(s.latest.top.kg)} kg × {s.latest.top.reps}
                </span>
              </button>
              {isOpen && (
                <div className="t-detail">
                  {s.points.length >= 2 ? (
                    <Spark
                      values={s.points.map((p) => p.top.kg)}
                      format={(v) => `${formatNumber(v)} kg`}
                      label={`Tyngsta set i ${s.name} över tid`}
                    />
                  ) : (
                    <p className="t-muted">Grafen kommer när du gjort övningen två gånger.</p>
                  )}
                  <ul className="t-points">
                    {s.points
                      .slice(-5)
                      .reverse()
                      .map((p, i) => (
                        <li key={`${p.date}-${i}`}>
                          <span>{shortDate(p.date, today)}</span>
                          <span>
                            {formatNumber(p.top.kg)} kg × {p.top.reps}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="t-muted">Bästa: {formatNumber(s.bestKg)} kg</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Liten linjegraf. Med lowerIsBetter vänds den, så att uppåt alltid är bättre. */
function Spark({
  values,
  goal,
  lowerIsBetter = false,
  format,
  label,
}: {
  values: number[];
  goal?: number;
  lowerIsBetter?: boolean;
  format: (v: number) => string;
  label: string;
}) {
  const W = 300;
  const H = 80;
  const pad = 8;
  const all = goal !== undefined ? [...values, goal] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => {
    const share = (v - min) / (max - min);
    return pad + (lowerIsBetter ? share : 1 - share) * (H - pad * 2);
  };
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = values[values.length - 1];
  return (
    <figure className="spark" aria-label={`${label}: från ${format(values[0])} till ${format(last)}`}>
      <div className="spark-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {goal !== undefined && <line className="goal" x1={0} x2={W} y1={y(goal)} y2={y(goal)} />}
          <polyline points={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="spark-dot"
          style={{ left: `${(x(values.length - 1) / W) * 100}%`, top: `${(y(last) / H) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <figcaption>
        <span>{format(values[0])}</span>
        {goal !== undefined && <span className="goal-key">Mål {format(goal)}</span>}
        <span>{format(last)}</span>
      </figcaption>
    </figure>
  );
}
