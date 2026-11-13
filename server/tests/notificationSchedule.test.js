import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, reminderFor } from '../src/services/notificationSchedule.js';

const task = (overrides = {}) => ({
  due_date: '2026-11-20',
  remind_7_days: 1,
  remind_3_days: 1,
  remind_1_day: 1,
  remind_due: 1,
  remind_overdue: 1,
  ...overrides,
});

test('deadline schedule respects each enabled interval and overdue occurrence date', () => {
  assert.equal(reminderFor(task(), '2026-11-13').key, '7_days');
  assert.equal(reminderFor(task(), '2026-11-17').key, '3_days');
  assert.equal(reminderFor(task(), '2026-11-19').key, '1_day');
  assert.equal(reminderFor(task(), '2026-11-20').key, 'due');
  assert.deepEqual(reminderFor(task(), '2026-11-21'), { key: 'overdue', occurrenceDate: '2026-11-21', label: 'is overdue' });
  assert.equal(reminderFor(task({ remind_3_days: 0 }), '2026-11-17'), null);
});

test('deadline schedule uses the configured timezone date', () => {
  const instant = new Date('2026-11-20T01:00:00.000Z');
  assert.equal(localDate('America/Los_Angeles', instant), '2026-11-19');
  assert.equal(localDate('Asia/Kolkata', instant), '2026-11-20');
});
