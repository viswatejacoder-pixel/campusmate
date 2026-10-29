// Subjects endpoints (api-spec.md "Subjects"). Every handler runs after requireAuth and uses req.userId only;
// a user id in the request body or URL is never read. A subject that is missing or owned by someone else gives the same 404.
import AppError from '../utils/AppError.js';
import { parseId, validateSubjectName } from '../validators/subjectValidator.js';
import { listByUser, createSubject, findOwned, renameSubject, deleteSubject } from '../models/subjectModel.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Subject not found.');
const subjectExists = () => new AppError(409, 'SUBJECT_EXISTS', 'You already have a subject with this name.');

function idFromParams(req) {
  const id = parseId(req.params.id);
  if (id === null) throw new AppError(400, 'BAD_ID', 'Subject id must be a positive whole number.');
  return id;
}

function nameFromBody(req) {
  const { fields, value } = validateSubjectName(req.body);
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', fields);
  }
  return value.name;
}

// The unique key on (user_id, name) is the source of truth, so two simultaneous requests cannot both succeed.
const isDuplicate = (err) => err.code === 'ER_DUP_ENTRY';
// The tasks foreign key (ON DELETE RESTRICT) is the source of truth for "in use".
const isReferenced = (err) => err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED';

export async function list(req, res) {
  res.json({ subjects: await listByUser(req.userId) });
}

export async function create(req, res) {
  const name = nameFromBody(req);
  try {
    const subject = await createSubject(req.userId, name);
    res.status(201).json({ subject });
  } catch (err) {
    throw isDuplicate(err) ? subjectExists() : err;
  }
}

export async function rename(req, res) {
  const id = idFromParams(req);
  const name = nameFromBody(req);
  try {
    await renameSubject(id, req.userId, name);
  } catch (err) {
    throw isDuplicate(err) ? subjectExists() : err;
  }
  const subject = await findOwned(id, req.userId);
  if (!subject) throw notFound();
  res.json({ subject });
}

export async function remove(req, res) {
  const id = idFromParams(req);
  let deleted;
  try {
    deleted = await deleteSubject(id, req.userId);
  } catch (err) {
    if (isReferenced(err)) {
      throw new AppError(409, 'SUBJECT_IN_USE', 'This subject still has tasks. Remove or reassign its tasks first.');
    }
    throw err;
  }
  if (!deleted) throw notFound();
  res.status(204).end();
}
