import { formatDisplayDate } from '../utils/dates.js';

// Upcoming deadlines panel (T-090). `deadlines` is { status: 'loading' | 'ready' | 'error', tasks } from its own request
// (pending tasks due today or later, soonest first), so a failure here only shows a notice in this panel.
export default function UpcomingDeadlines({ deadlines, onRetry }) {
  const { status, tasks } = deadlines;
  return (
    <section className="panel" aria-labelledby="deadlines-heading">
      <h2 id="deadlines-heading" tabIndex={-1}>Upcoming deadlines</h2>
      {status === 'loading' && (
        <p role="status" className="muted">
          Loading deadlines...
        </p>
      )}
      {status === 'error' && (
        <div className="form-error" role="alert">
          <p>Upcoming deadlines could not be loaded.</p>
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}
      {status === 'ready' && tasks.length === 0 && <p className="muted">No pending tasks are due from today onward.</p>}
      {status === 'ready' && tasks.length > 0 && (
        <ul className="deadline-list">
          {tasks.map((task) => (
            <li key={task.id} className="deadline-item">
              <span className="deadline-title break-anywhere">{task.title}</span>
              <span className="deadline-meta">
                {task.subjectName && <span className="break-anywhere">{task.subjectName}</span>}
                <time dateTime={task.dueDate}>{formatDisplayDate(task.dueDate)}</time>
                {task.isDueSoon && <span className="task-flag task-flag--due-soon">Due soon</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
