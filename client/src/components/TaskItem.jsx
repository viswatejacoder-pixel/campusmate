import { useState } from 'react';
import { formatDisplayDate } from '../utils/dates.js';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

// One task. The description opens in place. Every value is rendered as React text (escaped), never as HTML.
// The action buttons (T-080 M3) appear only when the matching handler is given. `locked` disables them (a request or a form is
// open); `pending` marks this task's own request. Button names include the title so a screen reader can tell the tasks apart.
export default function TaskItem({ task, locked = false, pending = false, onToggle, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `task-${task.id}-details`;
  const toggleLabel = task.isCompleted ? 'Mark incomplete' : 'Mark complete';

  return (
    <li className={`task-item${task.isCompleted ? ' task-item--completed' : ''}`} data-priority={task.priority}>
      <h3 className="task-title break-anywhere">{task.title}</h3>
      {(task.isOverdue || task.isDueSoon) && (
        <p className="task-flags">
          {task.isOverdue && <span className="task-flag task-flag--overdue">Overdue</span>}
          {task.isDueSoon && <span className="task-flag task-flag--due-soon">Due soon</span>}
        </p>
      )}
      <dl className="task-meta">
        <div>
          <dt>Subject</dt>
          <dd>{task.subjectName}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>
            <time dateTime={task.dueDate}>{formatDisplayDate(task.dueDate) || 'Unknown'}</time>
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{PRIORITY_LABELS[task.priority] ?? task.priority}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{task.isCompleted ? 'Completed' : 'Pending'}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="task-toggle"
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? 'Hide details' : 'Show details'}
      </button>
      {expanded && (
        <div id={detailsId} className="task-details">
          {task.description ? <p className="task-description">{task.description}</p> : <p className="muted">No description.</p>}
        </div>
      )}
      {(onToggle || onEdit || onDelete) && (
        <div className="task-actions">
          {onToggle && (
            <button type="button" className="task-toggle" disabled={locked} aria-label={`${toggleLabel}: ${task.title}`} onClick={() => onToggle(task)}>
              {pending ? 'Saving...' : toggleLabel}
            </button>
          )}
          {onEdit && (
            <button type="button" className="task-toggle" disabled={locked} aria-label={`Edit task: ${task.title}`} onClick={() => onEdit(task)}>
              Edit
            </button>
          )}
          {onDelete && (
            <button type="button" className="button-danger" disabled={locked} aria-label={`Delete task: ${task.title}`} onClick={() => onDelete(task)}>
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}
