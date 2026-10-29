# API Specification

Last updated: 2026-10-28 | Status: Proposed contract (nothing implemented or tested yet). The contract itself is unchanged by the move to React; only two notes in section 1 (single origin, JSON 404 for unknown `/api` paths) were added.

## 1. Conventions
- Base path `/api`; JSON request and response bodies (`Content-Type: application/json`). Non-JSON bodies on POST/PUT/PATCH are rejected with 415.
- Auth: session cookie (`connect.sid`, HttpOnly). All routes except register, login, and health require a session.
- The React client calls relative URLs (`/api/...`), so the browser only ever talks to one origin. In development the Vite dev server proxies `/api` to Express (D-015); in a production build Express serves the built client itself (D-020). Either way no CORS configuration is needed. The client calls `GET /api/auth/me` on load to find out whether a session exists, and treats any 401 as "logged out".
- Any `/api/...` path that matches no route returns a JSON 404 (`NOT_FOUND`), never the client's `index.html`.
- IDs are positive integers; anything else returns 400.
- Dates are `YYYY-MM-DD` strings. JSON field names are `camelCase`.
- A resource that does not exist **or belongs to another user** returns 404 (no information leak).

### Error format
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please fix the highlighted fields.",
             "fields": { "title": "Title is required." } } }
```
`fields` appears only for validation errors.

| Status | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` / `BAD_ID` | Invalid input or ID |
| 401 | `UNAUTHENTICATED` | No/expired session, or bad login |
| 404 | `NOT_FOUND` | Missing or not owned |
| 409 | `EMAIL_TAKEN` / `SUBJECT_EXISTS` / `SUBJECT_IN_USE` | Conflict |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body not JSON |
| 500 | `SERVER_ERROR` | Unexpected; generic message only |

## 2. Objects
**User:** `{ "id": 1, "name": "Asha Verma", "email": "asha@example.com" }` (never includes the hash)
**Subject:** `{ "id": 3, "name": "Data Structures" }`
**Task:**
```json
{ "id": 12, "title": "DS assignment 2", "description": "Linked lists", "subjectId": 3,
  "subjectName": "Data Structures", "dueDate": "2026-11-02", "priority": "high",
  "isCompleted": false, "completedAt": null, "isOverdue": false, "isDueSoon": true,
  "createdAt": "2026-10-25T10:00:00Z", "updatedAt": "2026-10-25T10:00:00Z" }
```
`isOverdue` and `isDueSoon` are computed by the server.

## 3. Endpoints

### Health
| Method + path | Auth | Response |
|---|---|---|
| `GET /api/health` | no | `200 { "status": "ok" }` (also checks DB connection) |

### Auth
| Method + path | Body | Success | Failures |
|---|---|---|---|
| `POST /api/auth/register` | `{name, email, password}` | `201 { user }`; also logs the user in | 400, 409 `EMAIL_TAKEN` |
| `POST /api/auth/login` | `{email, password}` | `200 { user }`; session id regenerated | 400, 401 generic "Invalid email or password." |
| `POST /api/auth/logout` | none | `204` | none (idempotent) |
| `GET /api/auth/me` | none | `200 { user }` | 401 |

### Subjects (auth required)
| Method + path | Body | Success | Failures |
|---|---|---|---|
| `GET /api/subjects` | none | `200 { subjects: [...] }` sorted by name | 401 |
| `POST /api/subjects` | `{name}` | `201 { subject }` | 400, 409 `SUBJECT_EXISTS` |
| `PUT /api/subjects/:id` | `{name}` | `200 { subject }` | 400, 404, 409 |
| `DELETE /api/subjects/:id` | none | `204` | 404, 409 `SUBJECT_IN_USE` |

### Tasks (auth required)
| Method + path | Body | Success | Failures |
|---|---|---|---|
| `GET /api/tasks` | query params below | `200 { tasks: [...] }` | 400 bad filter value |
| `GET /api/tasks/summary` | none | `200 { pending, completed, overdue, dueSoon }` | 401 |
| `GET /api/tasks/:id` | none | `200 { task }` | 400, 404 |
| `POST /api/tasks` | `{title, subjectId, dueDate, priority?, description?}` | `201 { task }` | 400 (incl. subject not owned) |
| `PUT /api/tasks/:id` | same as create | `200 { task }` | 400, 404 |
| `PATCH /api/tasks/:id/complete` | `{isCompleted: true\|false}` | `200 { task }` | 400, 404 |
| `DELETE /api/tasks/:id` | none | `204` | 400, 404 |

Route order: `/summary` must be registered before `/:id`.

**`GET /api/tasks` query parameters** (all optional, combined with AND):
`q` (text, max 100; matches title/description), `subjectId`, `priority` (`low|medium|high`), `status` (`all|pending|completed|overdue`, default `all`), `dueFrom`, `dueTo` (dates), `sort` (`dueDate|priority|createdAt`, default `dueDate`), `order` (`asc|desc`, default `asc`).

## 4. Validation rules
| Field | Rule |
|---|---|
| `name` (user) | trimmed, 1-100 chars |
| `email` | trimmed, lower-cased, valid format, max 255 |
| `password` | 8-72 characters (bcrypt limit); never trimmed or logged |
| subject `name` | trimmed, 1-100 chars |
| `title` | trimmed, 1-150 chars |
| `description` | optional, max 1000 chars |
| `dueDate` | real calendar date, `YYYY-MM-DD` |
| `priority` | one of `low`, `medium`, `high` (default `medium`) |
| `subjectId` | positive integer owned by the current user |
| `isCompleted` | boolean |

## 5. Open items
Due-soon window (3 days) and timezone handling: OQ-6, OQ-10. Pagination is intentionally absent from the MVP.
