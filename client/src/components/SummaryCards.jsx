import Icon from './Icon.jsx';
import { progressParts } from './ProgressPanel.jsx';

// The four dashboard counts from GET /api/tasks/summary. Text labels, so nothing relies on colour. React escapes all text.
// The caption under each count is static wording, except Completed, which shows the real share of all tasks.
const CARDS = [
  ['pending', 'Pending', 'includes overdue'],
  ['completed', 'Completed', null],
  ['overdue', 'Overdue', 'past their due date'],
  ['dueSoon', 'Due soon', 'closing in soon'],
];

export default function SummaryCards({ summary }) {
  const { percent, total } = progressParts(summary);
  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="visually-hidden">Summary</h2>
      <ul className="summary-cards">
        {CARDS.map(([key, label, caption], index) => (
          <li key={key} className={`summary-card summary-card--${key}`} style={{ '--i': index }}>
            <span className="summary-icon"><Icon name={key} size={18} /></span>
            <span className="summary-count">{summary[key]}</span>
            <span className="summary-label">{label}</span>
            <span className="summary-caption">{key === 'completed' ? (total === 0 ? 'no tasks yet' : `${percent}% of all tasks`) : caption}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Pending includes overdue and due soon tasks.</p>
    </section>
  );
}
