// Tasks endpoints (api-spec.md "Tasks"). Every handler runs after requireAuth and uses req.userId only; a user id in the
// body, query or URL is never read. A task that is missing or owned by someone else gives the same 404. A subjectId that is
// missing or owned by someone else gives the same 400, so neither case reveals whether the other user's id exists.
import AppError from '../utils/AppError.js';
import { parseId, validateTaskInput, validateCompletion, validateListQuery } from '../validators/taskValidator.js';
import { findOwned as findOwnedSubject } from '../models/subjectModel.js';
import {
  findOwned, listByUser, summaryByUser, createTask, updateTask, setCompleted, deleteTask,
} from '../models/taskModel.js';
import { cancelPendingForTask } from '../models/notificationModel.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Task not found.');
const invalid = (fields) => new AppError(400, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', fields);
const badSubject = () => invalid({ subjectId: 'Subject not found.' });
// The composite foreign key (subject_id, user_id) is the source of truth when the subject disappears mid-request.
const isMissingSubject = (err) => err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW';

function idFromParams(req) {
  const id = parseId(req.params.id);
  if (id === null) throw new AppError(400, 'BAD_ID', 'Task id must be a positive whole number.');
  return id;
}

function check({ fields, value }) {
  if (Object.keys(fields).length > 0) throw invalid(fields);
  return value;
}

async function requireOwnedSubject(subjectId, userId) {
  if (!(await findOwnedSubject(subjectId, userId))) throw badSubject();
}

export async function list(req, res) {
  const filters = check(validateListQuery(req.query));
  res.json({ tasks: await listByUser(req.userId, filters) });
}

export async function summary(req, res) {
  res.json(await summaryByUser(req.userId));
}

export async function getOne(req, res) {
  const task = await findOwned(idFromParams(req), req.userId);
  if (!task) throw notFound();
  res.json({ task });
}

export async function create(req, res) {
  const input = check(validateTaskInput(req.body));
  await requireOwnedSubject(input.subjectId, req.userId);
  let id;
  try {
    id = await createTask(req.userId, input);
  } catch (err) {
    throw isMissingSubject(err) ? badSubject() : err;
  }
  res.status(201).json({ task: await findOwned(id, req.userId) });
}

// Same body as create. The task is checked first, so another user's task is always 404 whatever subjectId is sent.
export async function update(req, res) {
  const id = idFromParams(req);
  const input = check(validateTaskInput(req.body));
  if (!(await findOwned(id, req.userId))) throw notFound();
  await requireOwnedSubject(input.subjectId, req.userId);
  try {
    await updateTask(id, req.userId, input);
  } catch (err) {
    throw isMissingSubject(err) ? badSubject() : err;
  }
  await cancelPendingForTask(id, req.userId);
  const task = await findOwned(id, req.userId);
  if (!task) throw notFound(); // deleted by a concurrent request
  res.json({ task });
}

export async function complete(req, res) {
  const id = idFromParams(req);
  const { isCompleted } = check(validateCompletion(req.body));
  await setCompleted(id, req.userId, isCompleted);
  await cancelPendingForTask(id, req.userId);
  const task = await findOwned(id, req.userId);
  if (!task) throw notFound();
  res.json({ task });
}

export async function remove(req, res) {
  const id = idFromParams(req);
  if (!(await deleteTask(id, req.userId))) throw notFound();
  res.status(204).end();
}
