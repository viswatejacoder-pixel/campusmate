// T-080 M1 automated checks for utils/validation.js (pure functions, no browser, no server).
// The expected limits and messages mirror server/src/validators (api-spec.md section 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSubjectName, validateTaskInput, validateTaskFilters, PRIORITIES, STATUSES, SORTS, ORDERS, LIMITS,
} from '../src/utils/validation.js';

const good = { title: 'DS assignment 2', description: 'Linked lists', subjectId: 3, dueDate: '2026-11-02', priority: 'high' };
const fieldsOf = (input) => validateTaskInput(input).fields;

test('M1-V01 the accepted values and limits match the server', () => {
  assert.deepEqual(PRIORITIES, ['low', 'medium', 'high']);
  assert.deepEqual(STATUSES, ['all', 'pending', 'completed', 'overdue']);
  assert.deepEqual(SORTS, ['dueDate', 'priority', 'createdAt']);
  assert.deepEqual(ORDERS, ['asc', 'desc']);
  assert.deepEqual(LIMITS, { name: 100, title: 150, description: 1000, search: 100 });
});

test('M1-V02 a full valid task passes unchanged', () => {
  assert.deepEqual(validateTaskInput(good), { fields: {}, value: good });
});

test('M1-V03 title and description are trimmed; a blank description becomes null; priority defaults to medium', () => {
  const { fields, value } = validateTaskInput({ title: '  Lab record  ', description: '   ', subjectId: 1, dueDate: '2026-11-02' });
  assert.deepEqual(fields, {});
  assert.deepEqual(value, { title: 'Lab record', description: null, subjectId: 1, dueDate: '2026-11-02', priority: 'medium' });
  assert.equal(validateTaskInput({ ...good, description: null }).value.description, null);
  assert.equal(validateTaskInput({ ...good, description: undefined }).value.description, null);
  assert.equal(validateTaskInput({ ...good, description: '  notes ' }).value.description, 'notes');
});

test('M1-V04 title: required, blank and non-text rejected, 150 characters allowed, 151 rejected', () => {
  for (const title of [undefined, null, '', '   ', 5, {}, ['x']]) assert.equal(fieldsOf({ ...good, title }).title, 'Title is required.', String(title));
  assert.equal(fieldsOf({ ...good, title: 'a'.repeat(150) }).title, undefined);
  assert.equal(fieldsOf({ ...good, title: 'a'.repeat(151) }).title, 'Title must be at most 150 characters.');
  assert.equal(fieldsOf({ ...good, title: ` ${'a'.repeat(150)} ` }).title, undefined, 'length is counted after trimming');
});

test('M1-V05 lengths are counted in characters, not UTF-16 units (an emoji is one character)', () => {
  assert.equal(fieldsOf({ ...good, title: '😀'.repeat(150) }).title, undefined);
  assert.equal(fieldsOf({ ...good, title: '😀'.repeat(151) }).title, 'Title must be at most 150 characters.');
  assert.equal(fieldsOf({ ...good, description: '😀'.repeat(1000) }).description, undefined);
  assert.equal(validateSubjectName({ name: '😀'.repeat(100) }).fields.name, undefined);
  assert.equal(validateTaskFilters({ q: '😀'.repeat(100) }).fields.q, undefined);
});

test('M1-V06 description: 1000 characters allowed, 1001 rejected, non-text rejected', () => {
  assert.equal(fieldsOf({ ...good, description: 'a'.repeat(1000) }).description, undefined);
  assert.equal(fieldsOf({ ...good, description: 'a'.repeat(1001) }).description, 'Description must be at most 1000 characters.');
  for (const description of [5, true, {}, ['x']]) assert.equal(fieldsOf({ ...good, description }).description, 'Description must be text.', String(description));
});

test('M1-V07 subjectId must be a positive whole JSON number up to 4294967295 (the text "3" is rejected, like the server)', () => {
  for (const subjectId of [1, 3, 4294967295]) assert.equal(fieldsOf({ ...good, subjectId }).subjectId, undefined, String(subjectId));
  for (const subjectId of [undefined, null]) assert.equal(fieldsOf({ ...good, subjectId }).subjectId, 'Subject is required.');
  for (const subjectId of [0, -1, 1.5, 4294967296, NaN, Infinity, '3', '', 'abc', true, {}, [3]]) {
    assert.equal(fieldsOf({ ...good, subjectId }).subjectId, 'Subject must be a valid subject id.', String(subjectId));
  }
});

test('M1-V08 dueDate: required, must be a real YYYY-MM-DD date; past dates are allowed', () => {
  for (const dueDate of [undefined, null, '']) assert.equal(fieldsOf({ ...good, dueDate }).dueDate, 'Due date is required.');
  for (const dueDate of ['2026-02-30', '2026-13-01', '2026-2-3', '2026-11-02T00:00:00Z', ' 2026-11-02', 20261102, '02-11-2026', '0999-01-01']) {
    assert.equal(fieldsOf({ ...good, dueDate }).dueDate, 'Due date must be a real date in YYYY-MM-DD format.', String(dueDate));
  }
  for (const dueDate of ['2024-02-29', '2020-01-01', '2026-12-31']) assert.equal(fieldsOf({ ...good, dueDate }).dueDate, undefined, dueDate);
});

test('M1-V09 priority: only low, medium or high (exact case); absent means medium', () => {
  for (const priority of PRIORITIES) assert.equal(validateTaskInput({ ...good, priority }).value.priority, priority);
  assert.equal(validateTaskInput({ ...good, priority: undefined }).value.priority, 'medium');
  for (const priority of ['urgent', 'HIGH', 'High', '', null, 2, {}]) {
    assert.equal(fieldsOf({ ...good, priority }).priority, 'Priority must be low, medium or high.', String(priority));
  }
});

test('M1-V10 every bad field is reported at once; non-object input reports the required fields', () => {
  const fields = fieldsOf({ title: '', description: 5, subjectId: 'x', dueDate: 'nope', priority: 'urgent' });
  assert.deepEqual(Object.keys(fields).sort(), ['description', 'dueDate', 'priority', 'subjectId', 'title']);
  for (const input of [undefined, null, 'text', 42, [], [good]]) {
    assert.deepEqual(Object.keys(fieldsOf(input)).sort(), ['dueDate', 'subjectId', 'title'], String(input));
  }
});

test('M1-V11 fields the server ignores (userId, id, isCompleted, completedAt) are not copied into value', () => {
  const { value } = validateTaskInput({ ...good, userId: 9, id: 1, isCompleted: true, completedAt: '2026-11-02T00:00:00Z' });
  assert.deepEqual(Object.keys(value).sort(), ['description', 'dueDate', 'priority', 'subjectId', 'title']);
});

test('M1-V12 subject name: trimmed, 1 to 100 characters, text only', () => {
  assert.deepEqual(validateSubjectName({ name: '  Data Structures ' }), { fields: {}, value: { name: 'Data Structures' } });
  assert.equal(validateSubjectName({ name: 'a'.repeat(100) }).fields.name, undefined);
  assert.equal(validateSubjectName({ name: 'a'.repeat(101) }).fields.name, 'Name must be at most 100 characters.');
  for (const input of [{}, { name: '' }, { name: '   ' }, { name: 5 }, { name: null }, null, undefined, 'DBMS']) {
    assert.equal(validateSubjectName(input).fields.name, 'Name is required.', JSON.stringify(input));
  }
  assert.deepEqual(Object.keys(validateSubjectName({ name: 'x', userId: 5 }).value), ['name']);
});

test('M1-V13 filters: nothing set means no filters and no errors; empty values mean "no filter"', () => {
  assert.deepEqual(validateTaskFilters(), { fields: {}, value: {} });
  assert.deepEqual(validateTaskFilters({}), { fields: {}, value: {} });
  const empty = { q: '', subjectId: '', priority: '', status: '', dueFrom: '', dueTo: '', sort: '', order: '' };
  assert.deepEqual(validateTaskFilters(empty), { fields: {}, value: {} });
  assert.deepEqual(validateTaskFilters({ q: null, subjectId: null, status: undefined }), { fields: {}, value: {} });
});

test('M1-V14 filters: every valid value is accepted; subjectId text becomes a number; q is trimmed', () => {
  const { fields, value } = validateTaskFilters({
    q: '  lab ', subjectId: '3', priority: 'high', status: 'overdue', dueFrom: '2026-11-01', dueTo: '2026-11-30', sort: 'priority', order: 'desc',
  });
  assert.deepEqual(fields, {});
  assert.deepEqual(value, { q: 'lab', subjectId: 3, priority: 'high', status: 'overdue', dueFrom: '2026-11-01', dueTo: '2026-11-30', sort: 'priority', order: 'desc' });
  assert.equal(validateTaskFilters({ subjectId: 7 }).value.subjectId, 7);
  for (const status of STATUSES) assert.equal(validateTaskFilters({ status }).value.status, status);
  for (const sort of SORTS) assert.equal(validateTaskFilters({ sort }).value.sort, sort);
  assert.deepEqual(validateTaskFilters({ q: '   ' }), { fields: {}, value: {} }, 'a blank search is no text filter');
});

test('M1-V15 filters: values the server would reject are rejected, naming the field', () => {
  const bad = {
    priority: 'urgent', status: 'done', sort: 'title; DROP TABLE tasks', order: 'up',
    subjectId: '1 OR 1=1', dueFrom: '2026-02-30', dueTo: '2026-2-3', q: 'a'.repeat(101),
  };
  const { fields } = validateTaskFilters(bad);
  assert.deepEqual(Object.keys(fields).sort(), Object.keys(bad).sort());
  for (const name of ['sort', 'status', 'priority', 'order']) assert.match(fields[name], /must be one of: /);
  for (const subjectId of ['abc', '0', '-1', '1.5', '01', '4294967296', 0, -1, 1.5, 4294967296, true, {}]) {
    assert.equal(validateTaskFilters({ subjectId }).fields.subjectId, 'Subject must be a valid subject id.', String(subjectId));
  }
  for (const status of ['ALL', 'Pending', ['all', 'pending'], 5]) assert.ok(validateTaskFilters({ status }).fields.status, String(status));
  assert.equal(validateTaskFilters({ q: 5 }).fields.q, 'Search must be text.');
});

test('M1-V16 filters: both date ends are inclusive; an end before the start is an error on dueTo', () => {
  assert.deepEqual(validateTaskFilters({ dueFrom: '2026-11-05', dueTo: '2026-11-05' }).fields, {});
  assert.deepEqual(validateTaskFilters({ dueFrom: '2026-11-05' }).fields, {});
  assert.deepEqual(validateTaskFilters({ dueTo: '2026-11-05' }).fields, {});
  assert.equal(validateTaskFilters({ dueFrom: '2026-11-05', dueTo: '2026-11-04' }).fields.dueTo, 'End date must not be before start date.');
});
