import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';

// Dashboard header (T-090): the task search (moved here from the filter bar) and the account. The page owns the text (the filter
// draft's `q`), so Clear filters empties this box too. `error` is the same message validateTaskFilters() gives for the search text.
export default function TopBar({ user, search, onSearchChange, searchDisabled = false, error }) {
  const name = (user && user.name) || '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <header className="topbar">
      <form className="topbar-search" role="search" aria-label="Search tasks" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="task-search" className="visually-hidden">Search tasks</label>
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            id="task-search"
            type="search"
            placeholder="Search tasks"
            autoComplete="off"
            value={search}
            disabled={searchDisabled}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'task-search-error' : undefined}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        {error && (
          <p id="task-search-error" className="field-error">
            {error}
          </p>
        )}
      </form>
      <div className="account">
        <NotificationBell />
        <span className="avatar" aria-hidden="true">{initial}</span>
        <div className="account-text">
          <span className="account-name break-anywhere">{name}</span>
          {user && user.email && <span className="account-email break-anywhere">{user.email}</span>}
        </div>
      </div>
    </header>
  );
}
