import { useRef, useState } from 'react';
import '../styles/dashboardPreview.css';
import {
  FILTERS, SUBJECTS, WEEK, addSampleTask, dateParts, dueLabel, filterTasks, INITIAL_TASKS, subjectName, subjectStats, summarize, taskStatus, toggleTask, upcoming,
} from './dashboardPreviewData.js';

// Design experiment (isolated, preview only) at /dashboard-preview. Everything here is local state over mock data: no API, auth, storage or theme.
// Sections mirror the real dashboard: overview counts, tasks with filters, deadlines, subject progress.

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
};

function Icon({ name, size = 18 }) {
  return (
    <svg className="dp-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
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
  all: 'No tasks yet.',
  pending: 'Everything is complete.',
  overdue: 'No overdue tasks. Nicely done.',
  done: 'Nothing completed yet.',
};

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
    <span className="dp-prio" data-level={level}>
      <span className="dp-prio-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => <i key={n} data-on={n <= PRIORITY_LEVEL[level] ? '1' : undefined} />)}
      </span>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function Ring({ percent }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <svg className="dp-ring" width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${percent}% of tasks complete`}>
      <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" className="dp-ring-track" />
      <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="dp-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 52 52)" />
      <text x="52" y="58" textAnchor="middle" className="dp-ring-text">{percent}%</text>
    </svg>
  );
}

export default function DashboardPreviewPage() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState('dashboard');
  const mainRef = useRef(null);

  const stats = summarize(tasks);
  const shown = filterTasks(tasks, filter);
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
  const weekMax = Math.max(...WEEK.values);

  function goTo(id) {
    setActive(id);
    if (id === 'dashboard') mainRef.current && mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    else if (typeof document !== 'undefined') {
      const el = document.getElementById(`dp-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const reviewOverdue = () => {
    setFilter('overdue');
    goTo('tasks');
  };

  const statCards = [
    ['pending', 'Pending', stats.pending, 'includes overdue', 'list', null],
    ['overdue', 'Overdue', stats.overdue, 'past their due date', 'alert', stats.overdue > 0 ? 'danger' : null],
    ['soon', 'Due soon', stats.dueSoon, 'within the next 2 days', 'clock', stats.dueSoon > 0 ? 'warn' : null],
    ['done', 'Completed', stats.done, `${stats.percent}% of all tasks`, 'check', null],
  ];

  return (
    <div className="dp-root">
      <aside className="dp-side">
        <div className="dp-brand">
          <span className="dp-mark" aria-hidden="true" />
          <span className="dp-brand-name">CampusMate</span>
        </div>
        <nav aria-label="Preview navigation" className="dp-nav">
          <ul>
            {NAV.map(([id, label]) => (
              <li key={id}>
                <button type="button" className="dp-nav-item" aria-current={active === id ? 'page' : undefined} onClick={() => goTo(id)}>
                  <Icon name={id} />
                  <span className="dp-nav-label">{label}</span>
                  {id === 'tasks' && <span className="dp-nav-count">{stats.pending}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="dp-user">
          <span className="dp-avatar" aria-hidden="true">AM</span>
          <span className="dp-user-text">
            <span className="dp-user-name">Alex Morgan</span>
            <span className="dp-user-note">Design preview, mock data</span>
          </span>
        </div>
      </aside>

      <main className="dp-main" ref={mainRef} id="dp-main">
        <div className="dp-topbar">
          <div className="dp-brand">
            <span className="dp-mark" aria-hidden="true" />
            <span>CampusMate</span>
          </div>
          <span className="dp-avatar" aria-hidden="true">AM</span>
        </div>

        <div className="dp-content">
          <header className="dp-head">
            <div>
              <p className="dp-eyebrow">{todayLabel()}</p>
              <h1 className="dp-title">{greeting()}, Alex</h1>
              <p className="dp-sub">
                {stats.overdue} overdue and {stats.dueSoon} due soon. {stats.pending} tasks pending across {SUBJECTS.length} subjects.
              </p>
            </div>
            <div className="dp-actions" role="group" aria-label="Quick actions">
              <button type="button" className="dp-btn dp-btn-primary" onClick={() => setTasks((t) => addSampleTask(t))}>
                <Icon name="plus" size={16} /> New task
              </button>
              <button type="button" className="dp-btn" onClick={reviewOverdue}>
                Review overdue
              </button>
              <button type="button" className="dp-btn" onClick={() => goTo('deadlines')}>
                Deadlines
              </button>
            </div>
          </header>

          <section className="dp-stats" aria-label="Overview">
            {statCards.map(([key, label, value, caption, icon, tone]) => (
              <div className="dp-stat dp-card" key={key} data-tone={tone || undefined}>
                <div className="dp-stat-top">
                  <span className="dp-stat-label">{label}</span>
                  <Icon name={icon} size={16} />
                </div>
                <p className="dp-stat-value">{value}</p>
                <p className="dp-stat-caption">{caption}</p>
              </div>
            ))}
          </section>

          <div className="dp-grid">
            <section className="dp-card dp-tasks" id="dp-tasks" aria-labelledby="dp-tasks-h">
              <div className="dp-card-head">
                <div>
                  <h2 id="dp-tasks-h" className="dp-h2">Tasks</h2>
                  <p className="dp-muted">
                    {shown.length} of {tasks.length} shown
                  </p>
                </div>
                <div className="dp-filters" role="group" aria-label="Filter tasks">
                  {FILTERS.map(([id, label]) => (
                    <button key={id} type="button" className="dp-filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="dp-empty">{EMPTY[filter]}</p>
              ) : (
                <ul className="dp-task-list">
                  {shown.map((t) => {
                    const status = taskStatus(t);
                    return (
                      <li key={t.id} className="dp-task" data-status={status}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={t.done}
                          className="dp-check"
                          aria-label={`${t.done ? 'Mark as pending' : 'Mark as complete'}: ${t.title}`}
                          onClick={() => setTasks((all) => toggleTask(all, t.id))}
                        >
                          <Icon name="check" size={13} />
                        </button>
                        <div className="dp-task-body">
                          <p className="dp-task-title">{t.title}</p>
                          <p className="dp-task-meta">
                            <span>{subjectName(t.subject)}</span>
                            <span className="dp-dot" aria-hidden="true" />
                            <span className="dp-due" data-status={status}>{t.done ? 'Done' : dueLabel(t.due)}</span>
                          </p>
                        </div>
                        <Priority level={t.priority} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="dp-side-col">
              <section className="dp-card dp-progress" aria-labelledby="dp-progress-h">
                <h2 id="dp-progress-h" className="dp-h2">Progress</h2>
                <div className="dp-progress-top">
                  <Ring percent={stats.percent} />
                  <p className="dp-progress-text">
                    <strong>{stats.done} of {stats.total}</strong> tasks complete
                    <span className="dp-muted">{stats.pending} left to go</span>
                  </p>
                </div>
                <div className="dp-week" role="img" aria-label="Sample: tasks completed each day this week">
                  {WEEK.values.map((v, i) => (
                    <div key={i} className="dp-week-col" data-today={i === todayIndex ? '1' : undefined}>
                      <span className="dp-week-bar" style={{ height: `${Math.max(6, Math.round((v / weekMax) * 64))}px` }} />
                      <span className="dp-week-label">{WEEK.labels[i]}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="dp-card dp-deadlines" id="dp-deadlines" aria-labelledby="dp-deadlines-h">
                <h2 id="dp-deadlines-h" className="dp-h2">Upcoming deadlines</h2>
                <ul className="dp-dl-list">
                  {upcoming(tasks).map((t) => {
                    const { day, month } = dateParts(t.due);
                    const status = taskStatus(t);
                    return (
                      <li key={t.id} className="dp-dl">
                        <span className="dp-date" data-status={status}>
                          <span className="dp-date-day">{day}</span>
                          <span className="dp-date-month">{month}</span>
                        </span>
                        <span className="dp-dl-body">
                          <span className="dp-dl-title">{t.title}</span>
                          <span className="dp-task-meta">
                            <span>{subjectName(t.subject)}</span>
                            <span className="dp-dot" aria-hidden="true" />
                            <span className="dp-due" data-status={status}>{dueLabel(t.due)}</span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>

          <section id="dp-subjects" className="dp-subjects" aria-labelledby="dp-subjects-h">
            <div className="dp-card-head">
              <h2 id="dp-subjects-h" className="dp-h2">Subjects</h2>
              <p className="dp-muted">Progress by completed tasks</p>
            </div>
            <ul className="dp-subject-grid">
              {subjectStats(tasks).map((s) => (
                <li key={s.id} className="dp-card dp-subject">
                  <div className="dp-subject-top">
                    <span className="dp-mono" aria-hidden="true">{initials(s.name)}</span>
                    <span className="dp-subject-pct">{s.percent}%</span>
                  </div>
                  <p className="dp-subject-name">{s.name}</p>
                  <p className="dp-muted">{s.code} &middot; {s.done} of {s.total} tasks</p>
                  <div className="dp-bar" role="progressbar" aria-label={`${s.name} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={s.percent}>
                    <span style={{ width: `${s.percent}%` }} />
                  </div>
                  <p className="dp-subject-next">{s.next === null ? 'All caught up' : `Next: ${dueLabel(s.next)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
