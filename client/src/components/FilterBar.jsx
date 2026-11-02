import FormField from './FormField.jsx';
import { validateTaskFilters } from '../utils/validation.js';
import { hasActiveFilters } from '../utils/taskFilters.js';

// Each list is [value sent to GET /api/tasks, label]. '' means "not sent", so the server default applies
// (status all, sort dueDate, order asc).
const PRIORITY_OPTIONS = [['', 'All priorities'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const STATUS_OPTIONS = [['', 'All'], ['pending', 'Pending'], ['completed', 'Completed'], ['overdue', 'Overdue']];
const SORT_OPTIONS = [['', 'Due date'], ['priority', 'Priority'], ['createdAt', 'Date created']];
const ORDER_OPTIONS = [['', 'Ascending'], ['desc', 'Descending']];

const options = (list) => list.map(([value, label]) => <option key={value} value={value}>{label}</option>);

// Search, subject, priority, status, due-date range, sort field and sort order (T-080 M5). Controlled by the page:
// `filters` is the draft (text values), onChange(name, value) edits one field, onReset() clears them all.
// Field errors come from the same validateTaskFilters() that builds the request; an invalid draft sends no request.
// The form never submits (Enter in the search box would otherwise reload the page).
export default function FilterBar({ filters, subjects, onChange, onReset }) {
  const { fields } = validateTaskFilters(filters);
  const set = (name) => (event) => onChange(name, event.target.value);
  return (
    <form className="filter-bar" role="search" aria-label="Filter tasks" onSubmit={(event) => event.preventDefault()}>
      <FormField id="filter-q" label="Search" type="search" autoComplete="off" value={filters.q} onChange={set('q')} error={fields.q} />
      <FormField id="filter-subject" as="select" label="Subject" value={filters.subjectId} onChange={set('subjectId')} error={fields.subjectId}>
        <option value="">All subjects</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={String(subject.id)}>
            {subject.name}
          </option>
        ))}
      </FormField>
      <FormField id="filter-priority" as="select" label="Priority" value={filters.priority} onChange={set('priority')} error={fields.priority}>
        {options(PRIORITY_OPTIONS)}
      </FormField>
      <FormField id="filter-status" as="select" label="Status" value={filters.status} onChange={set('status')} error={fields.status}>
        {options(STATUS_OPTIONS)}
      </FormField>
      <FormField id="filter-due-from" label="Due from" type="date" value={filters.dueFrom} onChange={set('dueFrom')} error={fields.dueFrom} />
      <FormField id="filter-due-to" label="Due to" type="date" value={filters.dueTo} onChange={set('dueTo')} error={fields.dueTo} />
      <FormField id="filter-sort" as="select" label="Sort by" value={filters.sort} onChange={set('sort')} error={fields.sort}>
        {options(SORT_OPTIONS)}
      </FormField>
      <FormField id="filter-order" as="select" label="Order" value={filters.order} onChange={set('order')} error={fields.order}>
        {options(ORDER_OPTIONS)}
      </FormField>
      <div className="form-actions">
        <button type="button" className="task-toggle" onClick={onReset} disabled={!hasActiveFilters(filters)}>
          Clear filters
        </button>
      </div>
    </form>
  );
}
