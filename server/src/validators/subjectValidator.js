// Input validation for the subjects endpoints (api-spec.md section 4). Pure functions: no I/O, nothing is logged.
const MAX_ID = 4294967295; // largest value of subjects.id (INT UNSIGNED)

// Route ids arrive as strings. Only plain positive integers that fit the column are accepted:
// "abc", "0", "-1", "1.5", "1e2", "01", " 1" and values above MAX_ID all return null (the controller answers 400 BAD_ID).
export function parseId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= MAX_ID ? id : null;
}

// Returns { fields, value }. `fields` is empty when the input is valid. Length is counted in characters (code points),
// like VARCHAR(100) in utf8mb4. Only `name` is read: any other body field (userId, id, ...) is ignored.
export function validateSubjectName(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const fields = {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) fields.name = 'Name is required.';
  else if (Array.from(name).length > 100) fields.name = 'Name must be at most 100 characters.';

  return { fields, value: { name } };
}
