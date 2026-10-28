# Architecture

Last updated: 2026-10-25 | Status: Proposed (nothing implemented yet)

## 1. Overview
A single Node.js/Express server does two jobs: it serves the static frontend (HTML/CSS/JS) and exposes a JSON REST API under `/api`. The browser's vanilla JavaScript calls the API with `fetch`. MySQL stores users, subjects, tasks, and sessions.

```
Browser (HTML/CSS/vanilla JS)
   |  fetch() JSON over HTTP, session cookie
   v
Express app
   |- static files (public/)
   |- /api routes -> middleware -> controllers -> models -> mysql2 pool
   v
MySQL (users, subjects, tasks, sessions)
```

## 2. Proposed directory structure
```
campusmate/
  .env.example  .gitignore  package.json  README.md
  docs/                      (documentation pack + docs/evidence/ for screenshots)
  sql/
    schema.sql               (tables; safe to re-run)
    seed.sql                 (optional demo data, fake users only)
  src/
    server.js                (loads env, starts listening)
    app.js                   (builds Express app; exported for tests)
    config/
      env.js                 (reads + validates env vars, fails fast)
      db.js                  (mysql2 connection pool)
      session.js             (session + MySQL store settings)
    routes/
      auth.routes.js  subjects.routes.js  tasks.routes.js
    controllers/
      auth.controller.js  subjects.controller.js  tasks.controller.js
    models/                  (all SQL lives here, parameterized)
      user.model.js  subject.model.js  task.model.js
    middleware/
      requireAuth.js  validate.js  errorHandler.js  notFound.js
    validators/              (pure functions: input -> errors or clean data)
      auth.validator.js  subject.validator.js  task.validator.js
    utils/
      httpError.js           (AppError class with status + code)
  public/
    index.html               (redirects to login or dashboard)
    login.html  register.html  dashboard.html
    css/styles.css
    js/
      api.js                 (fetch wrapper, handles 401 + errors)
      auth.js                (login/register page logic)
      dashboard.js           (page controller)
      tasks-ui.js            (render list, forms, filters)
      util.js                (date formatting, safe text helpers)
  tests/
    api/                     (automated API tests)
    manual/                  (manual test sheets, see TESTING.md)
```

## 3. Layer responsibilities
| Layer | Does | Must not |
|---|---|---|
| Routes | Map URL + method to middleware and controller | Contain logic |
| Middleware | Auth check, error handling, 404 | Query the DB for business data |
| Validators | Check and clean input | Touch DB or `req`/`res` |
| Controllers | Read request, call validator and model, send response | Write SQL |
| Models | Parameterized SQL, always scoped by `user_id` | Know about HTTP |
| Frontend JS | Render UI, call API, show errors | Be trusted for security |

## 4. Request lifecycle (example: `PUT /api/tasks/5`)
1. Session middleware loads session from cookie.
2. `requireAuth` returns 401 if no `userId` in session.
3. Controller runs the task validator; 400 with field errors if invalid.
4. Model runs `UPDATE ... WHERE id = ? AND user_id = ?`; zero rows affected means 404 (covers both missing and someone else's task).
5. Controller returns the updated task as JSON; any thrown `AppError` goes to `errorHandler`.

## 5. Conventions
- Naming: files `kebab-or-dot.case.js`, functions `camelCase`, DB columns `snake_case`, JSON fields `camelCase` (models map between them).
- Errors: throw `AppError(status, code, message, fields?)`; one `errorHandler` formats `{ "error": {...} }`. Unknown errors become a generic 500; details go to the server log only.
- `mysql2` pool uses `dateStrings: true` so DATE columns come back as `"YYYY-MM-DD"` strings, avoiding timezone shifts.
- Frontend writes user-provided text with `textContent`, never `innerHTML`.
- Code is CommonJS (`require`) unless decided otherwise.

## 6. Proposed dependencies (NOT yet approved; see DECISIONS D-008)
Runtime: `express`, `mysql2`, `express-session`, `express-mysql-session`, `bcryptjs`, `dotenv`. Dev: `supertest` (tests use Node's built-in `node:test`). No frontend framework, no ORM.

## 7. Deployment
Primary target is local run for demo. If hosting is required (OQ-11), production settings are listed in [security.md](security.md).
