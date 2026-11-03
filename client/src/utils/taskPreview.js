// Task preview (T-090 v3). Pure logic, no React: which pending tasks the dashboard shows before "View all tasks".
export const PREVIEW_LIMIT = 5;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const due = (task) => (typeof task.dueDate === 'string' && task.dueDate ? task.dueDate : '9999-12-31'); // no date: last
const overdue = (task, today) => task.isOverdue === true || (today !== undefined && due(task) < today);

// Pending tasks only, ranked: overdue first (longest overdue first), then nearest deadline. Ties: priority, then id. Never mutates `tasks`.
export function rankPreviewTasks(tasks, today) {
  return tasks
    .filter((task) => !task.isCompleted)
    .sort((a, b) => {
      const ao = overdue(a, today);
      const bo = overdue(b, today);
      if (ao !== bo) return ao ? -1 : 1;
      return due(a).localeCompare(due(b)) || (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.id - b.id;
    });
}

export const previewTasks = (tasks, today, limit = PREVIEW_LIMIT) => rankPreviewTasks([...tasks], today).slice(0, limit);
