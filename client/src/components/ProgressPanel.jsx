// Progress panel (T-090). Uses the real counts from GET /api/tasks/summary: `pending` already includes the overdue tasks, so
// total = pending + completed and "pending (not overdue)" = pending - overdue. The ring is decoration (aria-hidden); the
// percentage sentence and the legend carry every number as text.
export function progressParts(summary) {
  const pending = Math.max(0, Number(summary && summary.pending) || 0);
  const completed = Math.max(0, Number(summary && summary.completed) || 0);
  const overdue = Math.min(pending, Math.max(0, Number(summary && summary.overdue) || 0));
  const total = pending + completed;
  return { total, completed, overdue, open: pending - overdue, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

const RADIUS = 15.9155; // circumference is 100, so a dash length is a percentage

export default function ProgressPanel({ summary }) {
  const parts = progressParts(summary);
  const segments = [
    ['ring-done', parts.completed, 'Completed'],
    ['ring-open', parts.open, 'Pending, not overdue'],
    ['ring-overdue', parts.overdue, 'Overdue'],
  ];
  let offset = 0;
  return (
    <section className="panel panel--progress" aria-labelledby="progress-heading">
      <h2 id="progress-heading">Progress</h2>
      {parts.total === 0 ? (
        <p className="muted">No tasks yet, so there is no progress to show.</p>
      ) : (
        <>
          <svg className="progress-ring" viewBox="0 0 42 42" aria-hidden="true" focusable="false">
            <circle className="ring-track" cx="21" cy="21" r={RADIUS} />
            {segments.map(([className, count]) => {
              const length = (count / parts.total) * 100;
              const start = offset;
              offset += length;
              return length > 0 ? (
                <circle key={className} className={`ring-segment ${className}`} cx="21" cy="21" r={RADIUS} strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={25 - start} />
              ) : null;
            })}
            <text className="ring-label" x="21" y="21" textAnchor="middle" dominantBaseline="central">{parts.percent}%</text>
          </svg>
          <p className="progress-percent">
            <strong>{parts.percent}%</strong> completed ({parts.completed} of {parts.total} tasks)
          </p>
          <dl className="progress-legend">
            {segments.map(([className, count, label]) => (
              <div key={className}>
                <span className={`swatch swatch-${className}`} aria-hidden="true" />
                <dt>{label}</dt>
                <dd>{count}</dd>
                <span className="legend-bar" aria-hidden="true"><span className={`swatch-${className}`} style={{ width: `${(count / parts.total) * 100}%` }} /></span>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
