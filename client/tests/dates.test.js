// T-080 M1 automated checks for utils/dates.js (pure functions, no browser, no server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDateString, isRealDate, toDateString, todayString, formatDisplayDate } from '../src/utils/dates.js';

test('M1-D01 isRealDate accepts real calendar dates, including leap days', () => {
  for (const ok of ['2026-11-02', '2026-01-01', '2026-12-31', '2024-02-29', '2000-02-29', '1000-01-01', '9999-12-31']) {
    assert.equal(isRealDate(ok), true, ok);
  }
});

test('M1-D02 isRealDate rejects impossible dates, other formats and non-text', () => {
  const bad = [
    '2026-02-29', '1900-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-32',
    '2026-2-3', '2026-11-2', '26-11-02', '02-11-2026', '2026/11/02', '20261102', '2026-11-02T00:00:00Z', '2026-11-02 ',
    ' 2026-11-02', '2026-11-02\n', '0999-12-31', '', 'abc', '٢٠٢٦-١١-٠٢',
  ];
  for (const value of bad) assert.equal(isRealDate(value), false, JSON.stringify(value));
  for (const value of [undefined, null, 20261102, true, {}, [], ['2026-11-02'], new Date(2026, 10, 2)]) {
    assert.equal(isRealDate(value), false, String(value));
  }
});

test('M1-D03 parseDateString returns numeric parts or null', () => {
  assert.deepEqual(parseDateString('2026-11-02'), { year: 2026, month: 11, day: 2 });
  assert.deepEqual(parseDateString('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseDateString('2026-02-30'), null);
  assert.equal(parseDateString(undefined), null);
});

test('M1-D04 formatDisplayDate shows DD Mon YYYY for all twelve months', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  months.forEach((name, i) => {
    const mm = String(i + 1).padStart(2, '0');
    assert.equal(formatDisplayDate(`2026-${mm}-05`), `05 ${name} 2026`);
  });
});

test('M1-D05 formatDisplayDate keeps the day exactly as written (no off-by-one at month and year edges)', () => {
  assert.equal(formatDisplayDate('2026-11-02'), '02 Nov 2026');
  assert.equal(formatDisplayDate('2026-01-01'), '01 Jan 2026');
  assert.equal(formatDisplayDate('2026-12-31'), '31 Dec 2026');
  assert.equal(formatDisplayDate('2024-02-29'), '29 Feb 2024');
  assert.equal(formatDisplayDate('1000-01-01'), '01 Jan 1000');
});

test('M1-D06 formatDisplayDate returns an empty string for anything that is not a real YYYY-MM-DD date', () => {
  for (const value of ['2026-02-30', '2026-2-3', '2026-11-02T10:00:00Z', '', 'soon', undefined, null, 20261102, new Date(2026, 10, 2)]) {
    assert.equal(formatDisplayDate(value), '', String(value));
  }
});

test('M1-D07 the result does not depend on the machine time zone', () => {
  const realTz = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      process.env.TZ = tz;
      assert.equal(formatDisplayDate('2026-11-02'), '02 Nov 2026', tz);
      assert.equal(isRealDate('2026-11-02'), true, tz);
    }
  } finally {
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  }
});

test('M1-D08 toDateString uses the local calendar day and zero-pads (toISOString would shift the day near midnight)', () => {
  assert.equal(toDateString(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  assert.equal(toDateString(new Date(2026, 10, 2, 23, 59, 59)), '2026-11-02');
  assert.equal(toDateString(new Date(2026, 8, 5, 12, 0)), '2026-09-05');
  assert.equal(toDateString(new Date(2024, 1, 29, 12, 0)), '2024-02-29');
  assert.equal(toDateString(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('M1-D09 toDateString returns an empty string for an invalid Date or a non-Date', () => {
  for (const value of [new Date(NaN), '2026-11-02', 1793558504374, null, undefined, {}]) {
    assert.equal(toDateString(value), '', String(value));
  }
});

test('M1-D10 todayString formats the given moment and its output is a real date', () => {
  assert.equal(todayString(new Date(2026, 10, 2, 8, 15)), '2026-11-02');
  assert.equal(isRealDate(todayString()), true);
});

test('M1-D11 the module never feeds a date string to Date(...) or Date.parse', () => {
  const code = readFileSync(new URL('../src/utils/dates.js', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(code, /new Date\s*\(\s*[^)\s]/); // only new Date() with no argument is allowed
  assert.doesNotMatch(code, /Date\.parse|Date\.UTC|toISOString/);
});
