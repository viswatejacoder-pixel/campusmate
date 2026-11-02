// Subjects API wrappers (api-spec.md "Subjects"). All HTTP goes through request() in client.js, never fetch directly.
// Each wrapper resolves with the unwrapped object (or array) and throws ApiError on failure (409 SUBJECT_EXISTS / SUBJECT_IN_USE included).
import { request } from './client.js';

const subjectPath = (id) => `/api/subjects/${encodeURIComponent(id)}`;

export const listSubjects = async () => (await request('GET', '/api/subjects')).subjects;
export const createSubject = async (name) => (await request('POST', '/api/subjects', { body: { name } })).subject;
export const renameSubject = async (id, name) => (await request('PUT', subjectPath(id), { body: { name } })).subject;
// Resolves null (204). Refused with 409 SUBJECT_IN_USE while tasks still use the subject.
export const deleteSubject = (id) => request('DELETE', subjectPath(id));
