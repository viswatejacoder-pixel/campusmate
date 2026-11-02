// Task filter helpers (T-080 M5). Pure logic, no React: the filter bar's draft values, the request key and the search debounce.
// The draft holds the controls' raw text ('' = untouched = the server default). validateTaskFilters() (validation.js) turns it into
// the exact query parameters GET /api/tasks understands; nothing here invents a parameter.
import { validateTaskFilters } from './validation.js';
import { TASK_QUERY_KEYS } from '../api/tasks.js';

export const EMPTY_FILTERS = { q: '', subjectId: '', priority: '', status: '', dueFrom: '', dueTo: '', sort: '', order: '' };
export const SEARCH_DEBOUNCE_MS = 400;

// True when any control differs from untouched (including sort and order, so Clear filters also restores the default sort).
export const hasActiveFilters = (draft) => Object.values(draft || {}).some((v) => v !== '' && v !== undefined && v !== null);

// Stable text for a validated filter value: two values with the same key send the same request.
export const filterKey = (value) => JSON.stringify(TASK_QUERY_KEYS.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]));

// The summary is not filtered, so pending + completed is how many tasks the user has in total (pending includes overdue and due soon).
export const totalTaskCount = (summary) => (summary ? Number(summary.pending || 0) + Number(summary.completed || 0) : 0);

// Decides when a draft becomes a request. update(draft) is called on every change and may call apply(value):
// - an invalid draft sends nothing (the last results stay; the bar shows the field errors);
// - a draft that maps to the request already applied sends nothing (for example a trailing space in the search);
// - a search-text change waits `delay` ms after the last keystroke; any other control applies at once;
// - reset() cancels a waiting search and applies "no filters" at once, unless that is already applied.
// Only the newest draft can be waiting: every update and reset cancels the previous timer.
export function createFilterScheduler({ apply, delay = SEARCH_DEBOUNCE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let appliedValue = {};
  let appliedKey = filterKey({});
  let timer = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };
  const run = (value, key) => {
    cancel();
    appliedValue = value;
    appliedKey = key;
    apply(value);
  };

  return {
    get applied() {
      return appliedValue;
    },
    update(draft) {
      cancel();
      const { fields, value } = validateTaskFilters(draft);
      if (Object.keys(fields).length > 0) return;
      const key = filterKey(value);
      if (key === appliedKey) return;
      if ((value.q ?? '') === (appliedValue.q ?? '')) run(value, key);
      else timer = setTimer(() => run(value, key), delay);
    },
    reset() {
      cancel();
      if (appliedKey !== filterKey({})) run({}, filterKey({}));
    },
    dispose: cancel,
  };
}
