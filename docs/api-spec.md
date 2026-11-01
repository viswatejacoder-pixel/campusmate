# API Specification

Last updated: 2026-10-30 | Status: Proposed contract. Health, the six auth endpoints (T-030, T-075), the four subjects endpoints (T-040) and the seven tasks endpoints (T-050, uncommitted) are implemented and covered by scripted tests; there is nothing else in the contract. The contract itself is unchanged by the move to React; only two notes in section 1 (single origin, JSON 404 for unknown `/api` paths) were added.

## 1. Conventions
- Base path `/api`; JSON request and response bodies (`Content-Type: application/json`). Non-JSON bodies are rejected with 415; a body-less request (including `Content-Length: 0`) is fine, and a body over 10 KB gets 413.
- Auth: session cookie (`connect.sid`, HttpOnly). All routes except register, login, logout (idempotent, always 204), and health require a session.
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
| 413 | `PAYLOAD_TOO_LARGE` | JSON body over 10 KB |
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
| `POST /api/auth/register` | `{name, email, password}` | `201 { message }`; creates an UNVERIFIED account and emails a verification link; **no session** (T-075). Registering a still-unverified email replaces its pending name, password and token (not within 60 s of the last email) and answers the same 201 | 400, 409 `EMAIL_TAKEN` (verified email), 429 `RATE_LIMITED` |
| `POST /api/auth/login` | `{email, password}` | `200 { user }`; session id regenerated | 400 only when email or password is missing or not text; every other failure (unknown email, wrong password, password over 72 bytes) is the generic 401 "Invalid email or password." After a **correct** password, an unverified account gets `403 EMAIL_NOT_VERIFIED` (T-075); 429 `RATE_LIMITED` |
| `POST /api/auth/logout` | none | `204` | none (idempotent) |
| `GET /api/auth/me` | none | `200 { user }` | 401 |
| `POST /api/auth/verify-email` | `{token}` | `200 { message }`; marks the email verified; **no auto-login** (T-075) | `400 TOKEN_INVALID_OR_EXPIRED` for every failure (malformed, unknown, expired, already used); 429 |
| `POST /api/auth/resend-verification` | `{email}` | always `202 { message }`, identical for unknown, verified, in-cooldown and sent (T-075); a new token is issued only for an unverified account more than 60 s after the last email | 400 `VALIDATION_ERROR` (missing or malformed email); 429 |

Email verification (T-075): the token is 256-bit random (base64url, 43 characters), single-use, valid 30 minutes; only its SHA-256 hash is stored. The link is `APP_BASE_URL/verify-email?token=...` (client page, explicit Confirm button). `429 RATE_LIMITED` carries a `Retry-After` header. Per-IP limits: register 10/hour, login 10/15 min, verify-email 10/15 min, resend 5/15 min plus 3/15 min per email (in memory, reset on restart).

### Subjects (auth required)
| Method + path | Body | Success | Failures |
|---|---|---|---|
| `GET /api/subjects` | none | `200 { subjects: [...] }` sorted by name | 401 |
| `POST /api/subjects` | `{name}` | `201 { subject }` | 400, 409 `SUBJECT_EXISTS` |
| `PUT /api/subjects/:id` | `{name}` | `200 { subject }` | 400, 404, 409 |
| `DELETE /api/subjects/:id` | none | `204` | 404, 409 `SUBJECT_IN_USE` |

Behaviour (implemented and scripted-tested in T-040, SUB-01 to SUB-05): all four routes need a session (401 comes before any id or body check). A subject belongs to the logged-in user only; an id that is missing or owned by someone else gives the same 404, and a `userId` in the body is ignored. Names are trimmed and unique per user, also when they differ only in letter case (409 `SUBJECT_EXISTS`); renaming a subject to its own name returns 200. A malformed id (`abc`, `0`, `-1`, `1.5`, `01`, above 4294967295) gives 400 `BAD_ID`. Deleting a subject that tasks reference gives 409 `SUBJECT_IN_USE`; renaming it is still allowed.

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

Behaviour (implemented and scripted-tested in T-050, TASK-01 to TASK-09 and FIL-01 to FIL-05):
- All seven routes need a session; 401 comes before any id, body or query check. Ids use the same rules as subjects (`BAD_ID` for `abc`, `0`, `-1`, `1.5`, `01`, above 4294967295). A task that is missing or owned by someone else gives the same 404 `NOT_FOUND`; a `userId`, `id`, `isCompleted` or `completedAt` in a create or edit body is ignored.
- `POST` and `PUT` take the same body. `PUT` replaces all five editable fields: an omitted `description` is cleared and an omitted `priority` becomes `medium`; it never changes completion. `title` and `description` are trimmed; an empty or blank `description` is stored as null. `subjectId` must be a JSON number (the text `"3"` is a 400). Validation errors give 400 `VALIDATION_ERROR` with `error.fields`.
- A `subjectId` that does not exist or belongs to someone else gives 400 `VALIDATION_ERROR` with `fields.subjectId: "Subject not found."`, identical for both cases. For `PUT` the task is checked first, so another user's task is 404 whatever `subjectId` is sent. The composite foreign key also enforces it in the database.
- `PATCH /api/tasks/:id/complete` needs exactly `{isCompleted: true|false}` (anything else is 400 `isCompleted`). Completing sets `completedAt`; completing again keeps the first `completedAt`; un-completing sets it to null.
- `isOverdue` = not completed and `dueDate` before today; `isDueSoon` = not completed and `dueDate` from today up to and including today + 3 days (OQ-6). Today is the database server's `CURDATE()` (OQ-10). Completed tasks are never overdue or due soon; the two flags never both hold.
- `createdAt`, `updatedAt` and `completedAt` are ISO-8601 UTC strings without milliseconds (`2026-10-25T10:00:00Z`); `description` is null when absent.
- `GET /api/tasks/summary` returns `{pending, completed, overdue, dueSoon}`: `pending` is every task that is not completed (so it includes the overdue and due-soon ones), `overdue` and `dueSoon` are subsets of `pending` that do not overlap.
- List filters: a parameter that is present must be valid or the answer is 400 `VALIDATION_ERROR` naming it (an empty `subjectId`, `priority`, `status`, `sort`, `order`, `dueFrom` or `dueTo` is invalid; an empty or blank `q` means no text filter; a repeated parameter is invalid; unknown parameters are ignored). `dueTo` before `dueFrom` is a 400 on `dueTo`; both ends are inclusive. `subjectId` of another user's or a missing subject is not an error: it matches nothing and returns an empty list. `q` is trimmed, 1-100 characters, matches title or description ignoring case, and `%` and `_` match literally. `status=overdue` uses the same rule as `isOverdue`. Sorting: `priority` orders low, medium, high (`desc` reverses); ties go by due date ascending and then id; `dueDate` and `createdAt` break ties by id in the same direction.

## 4. Validation rules
| Field | Rule |
|---|---|
| `name` (user) | trimmed, 1-100 chars |
| `email` | trimmed, lower-cased, valid format, max 255 |
| `password` | 8-72 characters (bcrypt limit) and at most 72 bytes in UTF-8, because bcrypt ignores everything after 72 bytes; never trimmed or logged |
| subject `name` | trimmed, 1-100 chars |
| `title` | trimmed, 1-150 chars |
| `description` | optional, max 1000 chars |
| `dueDate` | real calendar date, `YYYY-MM-DD` |
| `priority` | one of `low`, `medium`, `high` (default `medium`) |
| `subjectId` | positive integer owned by the current user |
| `isCompleted` | boolean |

## 5. Open items
Due-soon window (3 days) and timezone handling: OQ-6, OQ-10. Pagination is intentionally absent from the MVP.
