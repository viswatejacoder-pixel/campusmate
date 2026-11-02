// T-080 M5 automated checks for the pure filter logic (utils/taskFilters.js): request mapping, search debounce, dedupe, reset.
// Timers are faked, so nothing here waits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, SEARCH_DEBOUNCE_MS, createFilterScheduler, filterKey, hasActiveFilters, totalTaskCount } from '../src/utils/taskFilters.js';

function harness() {
  const applied = [];
  const timers = new Map();
  let nextId = 1;
  const scheduler = createFilterScheduler({
    apply: (value) => applied.push(value),
    delay: SEARCH_DEBOUNCE_MS,
    setTimer: (fn, ms) => { timers.set(nextId, { fn, ms }); return nextId++; },
    clearTimer: (id) => timers.delete(id),
  });
  const fire = () => { const [id, t] = [...timers][0]; timers.delete(id); t.fn(); };
  return { scheduler, applied, timers, fire };
}
const draft = (changes) => ({ ...EMPTY_FILTERS, ...changes });

test('M5-F01 hasActiveFilters, filterKey and totalTaskCount', () => {
  assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  assert.equal(hasActiveFilters(draft({ order: 'desc' })), true, 'sort and order count, so Clear filters restores the default sort');
  assert.equal(filterKey({ status: 'overdue', q: 'x' }), filterKey({ q: 'x', status: 'overdue' }), 'key does not depend on property order');
  assert.notEqual(filterKey({ q: 'x' }), filterKey({ q: 'y' }));
  assert.equal(totalTaskCount({ pending: 3, completed: 2, overdue: 1, dueSoon: 1 }), 5, 'overdue and due soon are inside pending');
  assert.equal(totalTaskCount(null), 0);
});

test('M5-F02 search waits for a pause in typing and only the last text is sent', () => {
  const { scheduler, applied, timers, fire } = harness();
  scheduler.update(draft({ q: 'a' }));
  scheduler.update(draft({ q: 'ab' }));
  scheduler.update(draft({ q: ' abc ' }));
  assert.equal(applied.length, 0);
  assert.equal(timers.size, 1, 'each keystroke cancels the previous timer');
  assert.equal([...timers.values()][0].ms, SEARCH_DEBOUNCE_MS);
  fire();
  assert.deepEqual(applied, [{ q: 'abc' }], 'trimmed, once');
  assert.deepEqual(scheduler.applied, { q: 'abc' });
});

test('M5-F03 other controls apply at once with the exact backend query values', () => {
  const { scheduler, applied } = harness();
  scheduler.update(draft({ subjectId: '3', priority: 'high', status: 'overdue', dueFrom: '2026-11-01', dueTo: '2026-11-30', sort: 'priority', order: 'desc' }));
  assert.deepEqual(applied, [{ subjectId: 3, priority: 'high', status: 'overdue', dueFrom: '2026-11-01', dueTo: '2026-11-30', sort: 'priority', order: 'desc' }]);
  scheduler.update(draft({ subjectId: '3', priority: 'high', status: 'overdue', dueFrom: '2026-11-01', dueTo: '2026-11-30', sort: 'priority', order: 'desc' }));
  assert.equal(applied.length, 1, 'same request is not sent twice');
});

test('M5-F04 untouched, blank, trailing-space and invalid drafts send nothing', () => {
  const { scheduler, applied, timers } = harness();
  scheduler.update(EMPTY_FILTERS);
  scheduler.update(draft({ q: '   ' }));
  scheduler.update(draft({ dueFrom: '2026-02-31' }));
  scheduler.update(draft({ dueFrom: '2026-11-05', dueTo: '2026-11-04' }));
  assert.equal(applied.length, 0);
  assert.equal(timers.size, 0);
});

test('M5-F05 an invalid draft cancels a waiting search', () => {
  const { scheduler, applied, timers } = harness();
  scheduler.update(draft({ q: 'abc' }));
  assert.equal(timers.size, 1);
  scheduler.update(draft({ q: 'abc', dueFrom: 'nope' }));
  assert.equal(timers.size, 0);
  assert.equal(applied.length, 0);
});

test('M5-F06 reset applies "no filters" at once, bypassing the debounce', () => {
  const { scheduler, applied, timers, fire } = harness();
  scheduler.update(draft({ status: 'pending' }));
  scheduler.update(draft({ status: 'pending', q: 'abc' }));
  assert.equal(timers.size, 1);
  scheduler.reset();
  assert.equal(timers.size, 0, 'the waiting search is cancelled');
  assert.deepEqual(applied, [{ status: 'pending' }, {}]);
  scheduler.update(EMPTY_FILTERS); // the page resets its draft right after reset(): must not send again
  assert.equal(applied.length, 2);
  assert.deepEqual(scheduler.applied, {});
  assert.throws(fire, 'nothing left to fire');
});

test('M5-F07 reset with nothing applied sends nothing, but still cancels a waiting search', () => {
  const { scheduler, applied, timers } = harness();
  scheduler.update(draft({ q: 'abc' }));
  scheduler.reset();
  assert.equal(timers.size, 0);
  assert.equal(applied.length, 0, 'the list already shows the unfiltered result');
});

test('M5-F08 dispose cancels a waiting search', () => {
  const { scheduler, applied, timers } = harness();
  scheduler.update(draft({ q: 'abc' }));
  scheduler.dispose();
  assert.equal(timers.size, 0);
  assert.equal(applied.length, 0);
});
