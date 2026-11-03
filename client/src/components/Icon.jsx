// Small line-icon set (T-090 v3): one stroke weight, currentColor, decorative only (aria-hidden; every use sits beside a text label).
const PATHS = {
  dashboard: 'M4 4h7v8H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  deadlines: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  subjects: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  pending: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4',
  completed: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6',
  overdue: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  dueSoon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5h4',
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
