// Mock data and pure helpers for the dashboard design preview (/dashboard-preview). Local only: no API, no storage, no real user data.
// Due dates are day offsets from today (negative = past), so the preview always looks current.

export const SUBJECTS = [
  { id: 'ds', name: 'Data Structures', code: 'CS 201' },
  { id: 'os', name: 'Operating Systems', code: 'CS 240' },
  { id: 'la', name: 'Linear Algebra', code: 'MA 210' },
  { id: 'me', name: 'Microeconomics', code: 'EC 101' },
  { id: 'tw', name: 'Technical Writing', code: 'EN 150' },
];

export const INITIAL_TASKS = [
  { id: 't1', title: 'Problem set 4: graph traversal', subject: 'ds', priority: 'high', due: -2, done: false },
  { id: 't2', title: 'Lab report: process scheduling', subject: 'os', priority: 'high', due: -1, done: false },
  { id: 't3', title: 'Read chapter 7: price elasticity', subject: 'me', priority: 'medium', due: 0, done: false },
  { id: 't4', title: 'Eigenvalue practice sheet', subject: 'la', priority: 'high', due: 1, done: false },
  { id: 't5', title: 'Draft the methods section', subject: 'tw', priority: 'medium', due: 2, done: false },
  { id: 't6', title: 'Quiz prep: heaps and priority queues', subject: 'ds', priority: 'medium', due: 3, done: false },
  { id: 't7', title: 'Group presentation outline', subject: 'me', priority: 'low', due: 5, done: false },
  { id: 't8', title: 'Peer review for the team essay', subject: 'tw', priority: 'low', due: 6, done: false },
  { id: 't9', title: 'Set up the Linux virtual machine', subject: 'os', priority: 'low', due: -4, done: true },
  { id: 't10', title: 'Matrix decomposition notes', subject: 'la', priority: 'medium', due: -3, done: true },
  { id: 't11', title: 'Supply and demand worksheet', subject: 'me', priority: 'medium', due: -5, done: true },
  { id: 't12', title: 'Binary trees reading', subject: 'ds', priority: 'low', due: -6, done: true },
  { id: 't13', title: 'Citation formatting exercise', subject: 'tw', priority: 'low', due: -2, done: true },
  { id: 't14', title: 'Kernel modules reading', subject: 'os', priority: 'medium', due: -1, done: true },
];

// Sample titles the preview's "New task" action cycles through (it only adds to local state).
export const NEW_TASK_TITLES = [
  ['Outline the literature review', 'tw', 'medium'],
  ['Review lecture notes: virtual memory', 'os', 'low'],
  ['Practice dynamic programming set', 'ds', 'high'],
];

export const FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['overdue', 'Overdue'],
  ['done', 'Completed'],
];

export const WEEK = { labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], values: [2, 4, 3, 5, 2, 1, 0] };

export const subjectName = (id) => (SUBJECTS.find((s) => s.id === id) || { name: id }).name;

// 'done' | 'overdue' | 'soon' (today to two days ahead) | 'later'
export function taskStatus(task) {
  if (task.done) return 'done';
  if (task.due < 0) return 'overdue';
  return task.due <= 2 ? 'soon' : 'later';
}

export function summarize(tasks) {
  const count = (status) => tasks.filter((t) => taskStatus(t) === status).length;
  const done = count('done');
  const overdue = count('overdue');
  const soon = count('soon');
  const pending = tasks.length - done;
  return { total: tasks.length, done, pending, overdue, dueSoon: soon, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function filterTasks(tasks, filter) {
  const keep = { all: () => true, pending: (t) => !t.done, overdue: (t) => taskStatus(t) === 'overdue', done: (t) => t.done }[filter] || (() => true);
  // Open work first (most urgent first), finished work last.
  return tasks.filter(keep).slice().sort((a, b) => Number(a.done) - Number(b.done) || a.due - b.due);
}

export const toggleTask = (tasks, id) => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));

export function addSampleTask(tasks) {
  const [title, subject, priority] = NEW_TASK_TITLES[tasks.filter((t) => t.id.startsWith('n')).length % NEW_TASK_TITLES.length];
  return [...tasks, { id: `n${tasks.length + 1}`, title, subject, priority, due: 4, done: false }];
}

export const upcoming = (tasks, limit = 5) => tasks.filter((t) => !t.done).sort((a, b) => a.due - b.due).slice(0, limit);

export function subjectStats(tasks) {
  return SUBJECTS.map((s) => {
    const own = tasks.filter((t) => t.subject === s.id);
    const done = own.filter((t) => t.done).length;
    const next = own.filter((t) => !t.done).sort((a, b) => a.due - b.due)[0];
    return { ...s, total: own.length, done, percent: own.length ? Math.round((done / own.length) * 100) : 0, next: next ? next.due : null };
  });
}

export function dueLabel(due) {
  if (due < 0) return `Overdue ${-due}d`;
  if (due === 0) return 'Today';
  if (due === 1) return 'Tomorrow';
  return `In ${due} days`;
}

export function dateParts(due) {
  const d = new Date();
  d.setDate(d.getDate() + due);
  return { day: d.getDate(), month: d.toLocaleDateString('en-GB', { month: 'short' }) };
}
