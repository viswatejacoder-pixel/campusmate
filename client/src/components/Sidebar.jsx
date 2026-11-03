import Icon from './Icon.jsx';

// Dashboard sidebar (T-090). The links jump to sections of this page (the only route behind the login is /dashboard).
const ITEMS = [
  ['Dashboard', '#main-content', 'dashboard'],
  ['Tasks', '#tasks-heading', 'tasks'],
  ['Deadlines', '#deadlines-heading', 'deadlines'],
  ['Subjects', '#subjects-heading', 'subjects'],
];

export default function Sidebar({ onLogout, loggingOut = false }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span>CampusMate</span>
      </div>
      <nav aria-label="Dashboard sections">
        <ul className="nav-list">
          {ITEMS.map(([label, href, icon], index) => (
            <li key={href}>
              <a href={href} aria-current={index === 0 ? 'page' : undefined}>
                <Icon name={icon} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="button-secondary sidebar-logout" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? 'Logging out...' : 'Log out'}
      </button>
    </aside>
  );
}
