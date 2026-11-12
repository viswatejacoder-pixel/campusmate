import { useRef, useState } from 'react';
import '../styles/dashboardRichPreview.css';
import {
  DUE_OPTIONS, FILTERS, SUBJECTS, WEEK, activity, addTask, dateParts, dueLabel, filterTasks, INITIAL_TASKS, nextTask, parseTheme, subjectName, subjectStats, summarize, taskStatus, toggleTask, upcoming,
} from './dashboardRichPreviewData.js';

// Design experiment v2 (isolated, preview only) at /dashboard-rich-preview: "Rich Minimalism".
// Everything is local state over mock data: no API, auth, storage or global theme. The theme toggle only sets data-theme on this page's root.

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17" /></>,
  deadlines: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  subjects: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12v.01" /></>,
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
};

function Icon({ name, size = 18 }) {
  return (
    <svg className="rp-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  ['dashboard', 'Dashboard'],
  ['tasks', 'Tasks'],
  ['deadlines', 'Deadlines'],
  ['subjects', 'Subjects'],
];
const PRIORITY_LEVEL = { low: 1, medium: 2, high: 3 };
const EMPTY = {
  today: 'Nothing due today. Enjoy the breathing room.',
  all: 'No tasks yet.',
  pending: 'Everything is complete.',
  overdue: 'No overdue tasks. Nicely done.',
  done: 'Nothing completed yet.',
};
const STATUS_LABEL = { done: 'Done', overdue: 'Overdue', soon: 'Due soon', later: 'Upcoming' };

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
const initials = (name) => {
  const words = name.split(' ');
  return (words.length > 1 ? words.map((w) => w[0]).join('') : name.slice(0, 2)).slice(0, 2).toUpperCase();
};
const todayLabel = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function Priority({ level }) {
  return (
    <span className="rp-prio" data-level={level}>
      <span className="rp-prio-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => <i key={n} data-on={n <= PRIORITY_LEVEL[level] ? '1' : undefined} />)}
      </span>
      <span className="rp-prio-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
    </span>
  );
}

function Pill({ status, children }) {
  return <span className="rp-pill" data-status={status}>{children}</span>;
}

function Ring({ percent, size = 148, stroke = 11, label, caption }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <svg className="rp-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} data-small={caption ? undefined : '1'}>
      <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className="rp-ring-track" />
      {percent > 0 && (
        <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="rp-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform={`rotate(-90 ${mid} ${mid})`} />
      )}
      <text x={mid} y={caption ? mid - 3 : mid} textAnchor="middle" dominantBaseline="central" className="rp-ring-text">{percent}%</text>
      {caption && <text x={mid} y={mid + 24} textAnchor="middle" dominantBaseline="central" className="rp-ring-caption">{caption}</text>}
    </svg>
  );
}

export default function DashboardRichPreviewPage() {
  const [theme, setTheme] = useState(() => parseTheme(typeof window === 'undefined' ? '' : window.location.search));
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [filter, setFilter] = useState('today');
  const [active, setActive] = useState('dashboard');
  const [draft, setDraft] = useState({ title: '', subject: SUBJECTS[0].id, due: 0 });
  const mainRef = useRef(null);
  const inputRef = useRef(null);

  const stats = summarize(tasks);
  const shown = filterTasks(tasks, filter);
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
  const week = activity(tasks, todayIndex);
  const focus = nextTask(tasks);

  function goTo(id) {
    setActive(id);
    if (id === 'dashboard') {
      if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (typeof document !== 'undefined') {
      const el = document.getElementById(`rp-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const reviewOverdue = () => {
    setFilter('overdue');
    goTo('tasks');
  };
  const todaysFocus = () => {
    setFilter('today');
    goTo('tasks');
  };
  const newTask = () => {
    goTo('tasks');
    if (inputRef.current) inputRef.current.focus({ preventScroll: true });
  };
  function submit(event) {
    event.preventDefault();
    const next = addTask(tasks, draft);
    if (next === tasks) return;
    const created = next[next.length - 1];
    setTasks(next);
    setDraft((d) => ({ ...d, title: '' }));
    if (filterTasks([created], filter).length === 0) setFilter('pending'); // make sure the new task is visible
  }

  const statCards = [
    ['pending', 'Pending', stats.pending, 'includes overdue', 'list', null],
    ['overdue', 'Overdue', stats.overdue, 'past their due date', 'alert', stats.overdue > 0 ? 'danger' : null],
    ['soon', 'Due soon', stats.dueSoon, 'within the next 2 days', 'clock', stats.dueSoon > 0 ? 'warn' : null],
    ['done', 'Completed', stats.done, `${stats.percent}% of all tasks`, 'check', stats.done > 0 ? 'ok' : null],
  ];
  const actions = [
    ['plus', 'New task', 'Add to your list', newTask],
    ['flag', 'Review overdue', `${stats.overdue} need attention`, reviewOverdue],
    ['target', "Today's focus", 'Due today and late', todaysFocus],
    ['deadlines', 'Deadlines', 'See what is coming', () => goTo('deadlines')],
  ];

  return (
    <div className="rp-root" data-theme={theme}>
      <aside className="rp-side">
        <div className="rp-brand">
          <span className="rp-mark" aria-hidden="true" />
          <span className="rp-brand-name">CampusMate</span>
        </div>
        <nav aria-label="Preview navigation" className="rp-nav">
          <ul>
            {NAV.map(([id, label]) => (
              <li key={id}>
                <button type="button" className="rp-nav-item" aria-current={active === id ? 'page' : undefined} onClick={() => goTo(id)}>
                  <Icon name={id} />
                  <span className="rp-nav-label">{label}</span>
                  {id === 'tasks' && <span className="rp-nav-count">{stats.pending}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rp-goal">
          <p className="rp-goal-label">Weekly goal</p>
          <p className="rp-goal-value">{week.total}<span> / {week.goal} tasks</span></p>
          <div className="rp-bar" role="progressbar" aria-label="Weekly goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow={week.percent}>
            <span style={{ width: `${week.percent}%` }} />
          </div>
        </div>
        <div className="rp-user">
          <span className="rp-avatar" aria-hidden="true">AM</span>
          <span className="rp-user-text">
            <span className="rp-user-name">Alex Morgan</span>
            <span className="rp-user-note">Design preview, mock data</span>
          </span>
        </div>
      </aside>

      <main className="rp-main" ref={mainRef} id="rp-main">
        <div className="rp-topbar">
          <div className="rp-brand">
            <span className="rp-mark" aria-hidden="true" />
            <span>CampusMate</span>
          </div>
          <span className="rp-avatar" aria-hidden="true">AM</span>
        </div>

        <div className="rp-content">
          <header className="rp-head">
            <div className="rp-head-text">
              <p className="rp-eyebrow">{todayLabel()}</p>
              <h1 className="rp-title">{greeting()}, Alex</h1>
              <p className="rp-sub">
                {stats.overdue} overdue and {stats.dueSoon} due soon. {stats.pending} tasks pending across {SUBJECTS.length} subjects.
              </p>
            </div>
            <div className="rp-head-actions">
              <div className="rp-seg" role="group" aria-label="Preview theme">
                {[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([id, label, icon]) => (
                  <button key={id} type="button" className="rp-seg-btn" aria-pressed={theme === id} onClick={() => setTheme(id)}>
                    <Icon name={icon} size={15} /> <span>{label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="rp-btn" onClick={newTask}>
                <Icon name="plus" size={16} /> New task
              </button>
            </div>
          </header>

          <section className="rp-stats" aria-label="Overview">
            {statCards.map(([key, label, value, caption, icon, tone]) => (
              <div className="rp-stat rp-card" key={key} data-tone={tone || undefined}>
                <div className="rp-stat-top">
                  <span className="rp-stat-label">{label}</span>
                  <span className="rp-chip-icon"><Icon name={icon} size={16} /></span>
                </div>
                <p className="rp-stat-value">{value}</p>
                <p className="rp-stat-caption">{caption}</p>
                <span className="rp-meter" aria-hidden="true"><i style={{ width: `${stats.total ? Math.round((value / stats.total) * 100) : 0}%` }} /></span>
              </div>
            ))}
          </section>

          <div className="rp-grid">
            <section className="rp-card rp-hero rp-span-7" aria-labelledby="rp-progress-h">
              <div className="rp-card-head">
                <div>
                  <h2 id="rp-progress-h" className="rp-h2">Productivity</h2>
                  <p className="rp-muted">Overall progress and this week</p>
                </div>
                <Pill status={week.onPace ? 'done' : 'soon'}>{week.onPace ? 'On pace' : 'Behind pace'}</Pill>
              </div>
              <div className="rp-hero-body">
                <div className="rp-hero-ring">
                  <Ring percent={stats.percent} label={`${stats.percent}% of tasks complete`} caption="complete" />
                  <p className="rp-hero-count"><strong>{stats.done} of {stats.total}</strong> tasks done</p>
                </div>
                <div className="rp-hero-week">
                  <p className="rp-week-total">{week.total}<span> of {week.goal} tasks this week</span></p>
                  <div className="rp-bar" role="progressbar" aria-label="Weekly goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={week.percent}>
                    <span style={{ width: `${week.percent}%` }} />
                  </div>
                  <div className="rp-bars" role="img" aria-label="Sample: tasks completed each day this week">
                    {WEEK.labels.map((label, i) => {
                      const v = week.values[i];
                      return (
                        <div key={label} className="rp-bars-col" data-today={i === todayIndex ? '1' : undefined} data-future={v === null ? '1' : undefined}>
                          <span className="rp-bars-value">{v === null ? '' : v}</span>
                          <span className="rp-bars-bar" style={{ height: `${v === null ? 8 : 10 + Math.round((v / week.max) * 64)}px` }} />
                          <span className="rp-bars-label">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="rp-card rp-span-5" id="rp-deadlines" aria-labelledby="rp-deadlines-h">
              <div className="rp-card-head">
                <div>
                  <h2 id="rp-deadlines-h" className="rp-h2">Upcoming deadlines</h2>
                  <p className="rp-muted">Next five open tasks</p>
                </div>
              </div>
              <ul className="rp-dl-list">
                {upcoming(tasks).map((t) => {
                  const { day, month } = dateParts(t.due);
                  const status = taskStatus(t);
                  return (
                    <li key={t.id} className="rp-dl">
                      <span className="rp-date" data-status={status}>
                        <span className="rp-date-day">{day}</span>
                        <span className="rp-date-month">{month}</span>
                      </span>
                      <span className="rp-dl-body">
                        <span className="rp-dl-title">{t.title}</span>
                        <span className="rp-dl-meta">{subjectName(t.subject)}</span>
                      </span>
                      <Pill status={status}>{dueLabel(t.due)}</Pill>
                    </li>
                  );
                })}
                {upcoming(tasks).length === 0 && <li className="rp-empty">No upcoming deadlines.</li>}
              </ul>
            </section>

            <section className="rp-card rp-tasks rp-span-7" id="rp-tasks" aria-labelledby="rp-tasks-h">
              <div className="rp-card-head rp-tasks-head">
                <div>
                  <h2 id="rp-tasks-h" className="rp-h2">Today&rsquo;s tasks</h2>
                  <p className="rp-muted" aria-live="polite">{shown.length} of {tasks.length} shown</p>
                </div>
                <div className="rp-filters" role="group" aria-label="Filter tasks">
                  {FILTERS.map(([id, label]) => (
                    <button key={id} type="button" className="rp-filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="rp-empty">{EMPTY[filter]}</p>
              ) : (
                <ul className="rp-task-list">
                  {shown.map((t) => {
                    const status = taskStatus(t);
                    return (
                      <li key={t.id} className="rp-task" data-status={status}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={t.done}
                          className="rp-check"
                          aria-label={`${t.done ? 'Mark as pending' : 'Mark as complete'}: ${t.title}`}
                          onClick={() => setTasks((all) => toggleTask(all, t.id))}
                        >
                          <Icon name="check" size={13} />
                        </button>
                        <div className="rp-task-body">
                          <p className="rp-task-title">{t.title}</p>
                          <p className="rp-task-meta">
                            <span>{subjectName(t.subject)}</span>
                            <Pill status={status}>{t.done ? 'Done' : dueLabel(t.due)}</Pill>
                          </p>
                        </div>
                        <Priority level={t.priority} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <form className="rp-add" onSubmit={submit} aria-label="Add a task">
                <input ref={inputRef} className="rp-input rp-add-title" type="text" maxLength={80} placeholder="Add a task" aria-label="Task title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                <select className="rp-input" aria-label="Subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}>
                  {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="rp-input" aria-label="Due" value={draft.due} onChange={(e) => setDraft((d) => ({ ...d, due: Number(e.target.value) }))}>
                  {DUE_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <button type="submit" className="rp-btn rp-add-submit"><Icon name="plus" size={16} /> Add</button>
              </form>
            </section>

            <div className="rp-side-col rp-span-5">
              <section className="rp-card rp-next" aria-labelledby="rp-next-h">
                <h2 id="rp-next-h" className="rp-h2">Up next</h2>
                {focus ? (
                  <>
                    <p className="rp-next-title">{focus.title}</p>
                    <p className="rp-task-meta">
                      <span>{subjectName(focus.subject)}</span>
                      <Pill status={taskStatus(focus)}>{dueLabel(focus.due)}</Pill>
                      <Priority level={focus.priority} />
                    </p>
                    <button type="button" className="rp-btn rp-btn-quiet" onClick={() => setTasks((all) => toggleTask(all, focus.id))}>
                      <Icon name="check" size={16} /> Mark complete
                    </button>
                  </>
                ) : (
                  <p className="rp-empty">All caught up. Nothing is waiting for you.</p>
                )}
              </section>

              <section className="rp-card" aria-labelledby="rp-actions-h">
                <h2 id="rp-actions-h" className="rp-h2">Quick actions</h2>
                <div className="rp-tiles">
                  {actions.map(([icon, label, hint, run]) => (
                    <button key={label} type="button" className="rp-tile" onClick={run}>
                      <span className="rp-chip-icon"><Icon name={icon} size={16} /></span>
                      <span className="rp-tile-text">
                        <span className="rp-tile-label">{label}</span>
                        <span className="rp-tile-hint">{hint}</span>
                      </span>
                      <Icon name="arrow" size={14} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <section id="rp-subjects" className="rp-subjects" aria-labelledby="rp-subjects-h">
            <div className="rp-card-head">
              <h2 id="rp-subjects-h" className="rp-h2">Subjects</h2>
              <p className="rp-muted">Progress by completed tasks</p>
            </div>
            <ul className="rp-subject-grid">
              {subjectStats(tasks).map((s) => (
                <li key={s.id} className="rp-card rp-subject">
                  <div className="rp-subject-top">
                    <span className="rp-mono" aria-hidden="true">{initials(s.name)}</span>
                    <Ring percent={s.percent} size={52} stroke={5} label={`${s.name}: ${s.percent}% complete`} />
                  </div>
                  <p className="rp-subject-name">{s.name}</p>
                  <p className="rp-muted">{s.code} &middot; {s.done} of {s.total} tasks</p>
                  <div className="rp-ticks" role="progressbar" aria-label={`${s.name} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={s.percent}>
                    {Array.from({ length: s.total }, (_, i) => <i key={i} data-on={i < s.done ? '1' : undefined} />)}
                  </div>
                  <p className="rp-subject-next">{s.next === null ? 'All caught up' : `Next: ${dueLabel(s.next)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
