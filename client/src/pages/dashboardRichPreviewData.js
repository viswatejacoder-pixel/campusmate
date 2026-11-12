// Mock data and pure helpers for the rich dashboard preview (/dashboard-rich-preview). Local only: no API, storage or real user data.
// Due dates are day offsets from today (negative = past), so the preview always looks current. Self-contained on purpose.

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
  { id: 't15', title: 'Review lecture notes: scheduling', subject: 'os', priority: 'low', due: 0, done: false },
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

export const FILTERS = [
  ['today', 'Today'],
  ['pending', 'Pending'],
  ['overdue', 'Overdue'],
  ['done', 'Done'],
  ['all', 'All'],
];

export const DUE_OPTIONS = [
  [0, 'Today'],
  [1, 'Tomorrow'],
  [3, 'In 3 days'],
  [7, 'Next week'],
];

export const THEMES = ['light', 'dark'];
// Initial theme for this preview only (?theme=dark); never stored and never touches the app's global theme.
export const parseTheme = (search) => {
  const value = new URLSearchParams(search || '').get('theme');
  return THEMES.includes(value) ? value : 'light';
};

export const WEEK = { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [2, 4, 3, 5, 2, 1, 0] };
export const WEEK_GOAL = 20;
const RANK = { high: 3, medium: 2, low: 1 };
const BASE_DONE = INITIAL_TASKS.filter((t) => t.done).length;

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
  return { total: tasks.length, done, pending: tasks.length - done, overdue: count('overdue'), dueSoon: count('soon'), percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function filterTasks(tasks, filter) {
  const keep = { all: () => true, today: (t) => !t.done && t.due <= 0, pending: (t) => !t.done, overdue: (t) => taskStatus(t) === 'overdue', done: (t) => t.done }[filter] || (() => true);
  // Open work first (most urgent first), finished work last.
  return tasks.filter(keep).slice().sort((a, b) => Number(a.done) - Number(b.done) || a.due - b.due);
}

export const toggleTask = (tasks, id) => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));

// Local task creation. Returns the same array when the title is empty. Priority is derived from how soon it is due.
export function addTask(tasks, { title, subject, due }) {
  const clean = String(title || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!clean) return tasks;
  const days = Number.isFinite(Number(due)) ? Number(due) : 3;
  const sub = SUBJECTS.some((s) => s.id === subject) ? subject : SUBJECTS[0].id;
  return [...tasks, { id: `n${tasks.length + 1}`, title: clean, subject: sub, priority: days <= 1 ? 'high' : 'medium', due: days, done: false }];
}

export const upcoming = (tasks, limit = 5) => tasks.filter((t) => !t.done).sort((a, b) => a.due - b.due).slice(0, limit);
export const nextTask = (tasks) => tasks.filter((t) => !t.done).sort((a, b) => a.due - b.due || RANK[b.priority] - RANK[a.priority])[0] || null;

export function subjectStats(tasks) {
  return SUBJECTS.map((s) => {
    const own = tasks.filter((t) => t.subject === s.id);
    const done = own.filter((t) => t.done).length;
    const next = own.filter((t) => !t.done).sort((a, b) => a.due - b.due)[0];
    return { ...s, total: own.length, done, percent: own.length ? Math.round((done / own.length) * 100) : 0, next: next ? next.due : null };
  });
}

// Mock weekly activity. Days after today are null; completions made in the preview count towards today.
export function activity(tasks, todayIndex) {
  const extra = Math.max(0, tasks.filter((t) => t.done).length - BASE_DONE);
  const values = WEEK.values.map((v, i) => (i < todayIndex ? v : i === todayIndex ? v + extra : null));
  const total = values.reduce((sum, v) => sum + (v || 0), 0);
  const expected = Math.round((WEEK_GOAL * (todayIndex + 1)) / 7);
  return { values, total, goal: WEEK_GOAL, percent: Math.min(100, Math.round((total / WEEK_GOAL) * 100)), max: Math.max(1, ...values.map((v) => v || 0)), onPace: total >= expected };
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
