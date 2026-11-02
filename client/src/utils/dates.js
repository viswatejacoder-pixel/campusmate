// Date helpers (T-080 M1). The API sends dates as plain "YYYY-MM-DD" text (api-spec.md section 1).
// Text like that must never be passed to the Date constructor or Date.parse: it is read as UTC midnight, so in a time zone
// behind UTC it shows the previous day. Here dates are checked and shown by working on the text itself.
// The only Date used is "now" (todayString), read with local getters; toISOString() is avoided because it is UTC.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y, m) => {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
};
const pad = (n, width) => String(n).padStart(width, '0');

// { year, month, day } for a real calendar date written exactly as YYYY-MM-DD, otherwise null. Same rule as the server
// (taskValidator.js isRealDate): rejects 2026-02-30, 2026-13-01, 2026-2-3, date-times, padded text and years before 1000.
export function parseDateString(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export const isRealDate = (value) => parseDateString(value) !== null;

// Formats a Date as YYYY-MM-DD using its LOCAL calendar day (what the student sees on the wall calendar). '' for an invalid Date.
export function toDateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

// Today's local date as YYYY-MM-DD. `now` can be passed in for tests.
export const todayString = (now = new Date()) => toDateString(now);

// "2026-11-02" -> "02 Nov 2026". '' when the value is not a real YYYY-MM-DD date.
export function formatDisplayDate(value) {
  const parts = parseDateString(value);
  if (!parts) return '';
  return `${pad(parts.day, 2)} ${MONTHS[parts.month - 1]} ${parts.year}`;
}
