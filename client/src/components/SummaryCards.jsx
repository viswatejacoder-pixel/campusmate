// The four dashboard counts from GET /api/tasks/summary. Text labels, so nothing relies on colour. React escapes all text.
const CARDS = [
  ['pending', 'Pending'],
  ['completed', 'Completed'],
  ['overdue', 'Overdue'],
  ['dueSoon', 'Due soon'],
];

export default function SummaryCards({ summary }) {
  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <ul className="summary-cards">
        {CARDS.map(([key, label]) => (
          <li key={key} className="summary-card">
            <span className="summary-count">{summary[key]}</span>
            <span className="summary-label">{label}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Pending includes overdue and due soon tasks.</p>
    </section>
  );
}
