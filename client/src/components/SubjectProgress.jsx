// Per-subject progress under the subject list (Liquid Glass design): "2 of 2 done" with a bar. The numbers come from the full, unfiltered
// task list (DashboardPage fetches it), so a filter on the task list never changes them. Names render as React text only.
export function subjectStats(subjects, tasks) {
  const rows = new Map(subjects.map((subject) => [subject.id, { id: subject.id, name: subject.name, done: 0, total: 0 }]));
  for (const task of tasks) {
    const row = rows.get(task.subjectId);
    if (!row) continue;
    row.total += 1;
    if (task.isCompleted) row.done += 1;
  }
  return [...rows.values()];
}

export default function SubjectProgress({ subjects, tasks }) {
  if (subjects.length === 0) return null;
  const stats = subjectStats(subjects, tasks);
  return (
    <ul className="subject-progress" aria-label="Progress by subject">
      {stats.map((row) => (
        <li key={row.id}>
          <span className="sp-dot" aria-hidden="true" />
          <span className="sp-name break-anywhere">{row.name}</span>
          <span className="sp-count">{row.total === 0 ? 'No tasks yet' : `${row.done} of ${row.total} done`}</span>
          <span className="sp-bar" aria-hidden="true"><span style={{ width: `${row.total === 0 ? 0 : Math.round((row.done / row.total) * 100)}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
