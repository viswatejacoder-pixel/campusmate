const REMINDERS = [
  ['7_days', 7, 'remind_7_days'],
  ['3_days', 3, 'remind_3_days'],
  ['1_day', 1, 'remind_1_day'],
  ['due', 0, 'remind_due'],
];

export function localDate(timezone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

export function reminderFor(task, today) {
  const difference = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const planned = REMINDERS.find(([, days, preference]) => difference === days && task[preference]);
  if (planned) return { key: planned[0], occurrenceDate: task.due_date, label: difference === 0 ? 'is due today' : `is due in ${difference} day${difference === 1 ? '' : 's'}` };
  if (difference < 0 && task.remind_overdue) return { key: 'overdue', occurrenceDate: today, label: 'is overdue' };
  return null;
}
